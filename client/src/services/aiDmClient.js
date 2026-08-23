/**
 * AI Dungeon Master — Adaptive Story Engine
 * Uses Pollinations OpenAI-compatible free chat endpoint (no key, no 402)
 * Falls back to rich procedural D&D 5e narrative that ALWAYS directly reacts to the player's action.
 */

const SYSTEM_PROMPT = `Ты — жёсткий и непредсказуемый Мастер Подземелий (Dungeon Master) в Dungeons & Dragons 5e.

ПРАВИЛА:
- Ты ВСЕГДА реагируешь ИМЕННО на то, что написал игрок — никакого игнорирования!
- Если игрок говорит "открыть сундук" — ты описываешь открытие сундука. Если говорит "дрочить" — ты реагируешь с юмором и переводишь в контекст D&D (например, "Твой варвар занимается неловким делом прямо в подземелье. Соратники смотрят с недоумением, а гоблин за углом начинает хихикать..."). Ни одно действие не игнорируется!
- Пиши на русском языке. Ответ 3-5 предложений — живо и образно.
- В конце предложи 3 варианта следующего действия.
- Если нужен бросок — укажи [ПРОВЕРКА: Название навыка, DC: число]`;

export async function fetchAiDmNarrative({ prompt, history = [], players = [] }) {
  const userPrompt = (prompt || '').trim();
  if (!userPrompt) return buildFallback('осмотреться', players);

  // Build recent history context
  const recentHistory = history.slice(-6).map(h => ({
    role: h.isAi ? 'assistant' : 'user',
    content: h.text || ''
  })).filter(m => m.content);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recentHistory,
    { role: 'user', content: `Действие игрока: "${userPrompt}"\nИгроки в отряде: ${players.map(p => p.nickname || 'Безымянный').join(', ')}` }
  ];

  // Attempt 1: Pollinations OpenAI-compatible FREE chat endpoint (no key needed)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        messages,
        temperature: 0.9,
        max_tokens: 400,
        private: true
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 20) {
        return parseAiResponse(text, userPrompt);
      }
    }
  } catch (e) {
    console.warn('[AI DM] Pollinations timeout or error, using local engine:', e.message);
  }

  // Attempt 2: Guaranteed local procedural engine — always reacts to player's exact action
  return buildFallback(userPrompt, players);
}

function parseAiResponse(text, userPrompt) {
  let checkRequired = null;
  const checkMatch = text.match(/\[ПРОВЕРКА:\s*([^,]+),\s*DC:\s*(\d+)\]/i);
  if (checkMatch) {
    checkRequired = {
      skill: checkMatch[1].trim(),
      dc: parseInt(checkMatch[2], 10),
      description: `Проверка для: "${userPrompt.slice(0, 30)}"`
    };
  }

  // Auto-detect check if action implies one
  if (!checkRequired) {
    const lower = userPrompt.toLowerCase();
    if (/атак|удар|взорв|слома|пробит|рубит|прыгн/.test(lower))
      checkRequired = { skill: 'Атака / Атлетика (STR)', dc: 13, description: 'Физическое действие' };
    else if (/убеди|договор|обман|прируч|подкуп|торгуй/.test(lower))
      checkRequired = { skill: 'Убеждение / Обман (CHA)', dc: 14, description: 'Социальное взаимодействие' };
    else if (/спрят|прокрадыва|тихо|незамет|скрыт/.test(lower))
      checkRequired = { skill: 'Скрытность (DEX)', dc: 13, description: 'Скрытное перемещение' };
    else if (/маги|заклинани|руны|свитк|заклятье/.test(lower))
      checkRequired = { skill: 'Магия / Аркана (INT)', dc: 12, description: 'Магическое действие' };
    else if (/открыт|взлома|замок|сундук|дверь/.test(lower))
      checkRequired = { skill: 'Анализ / Ловкость рук (DEX)', dc: 12, description: 'Открытие замка или ловушки' };
  }

  // Extract clean narrative text (remove check tag)
  const cleanText = text.replace(/\[ПРОВЕРКА:[^\]]+\]/gi, '').trim();

  // Extract suggested actions if numbered list present
  const suggestedActions = extractSuggested(text) || defaultActions(userPrompt);

  return { narrative: cleanText, checkRequired, suggestedActions };
}

function extractSuggested(text) {
  const lines = text.split('\n');
  const actions = [];
  for (const line of lines) {
    const m = line.match(/^[1-3][.)]\s+(.+)/);
    if (m && m[1].trim().length > 3) actions.push(m[1].trim());
  }
  return actions.length >= 2 ? actions.slice(0, 3) : null;
}

function defaultActions(userPrompt) {
  const lower = userPrompt.toLowerCase();
  if (/сундук|открыт|замок/.test(lower))
    return ['Взять содержимое сундука', 'Осмотреть сундук на ловушки', 'Оставить сундук и идти дальше'];
  if (/атак|удар|бой|рубит/.test(lower))
    return ['Продолжить атаку', 'Отступить и занять позицию', 'Использовать специальный приём'];
  if (/убеди|говор|кричи|шепч/.test(lower))
    return ['Настаивать на своём', 'Попробовать запугать', 'Предложить сделку'];
  return ['Осмотреть окружение', 'Приготовиться к бою', 'Двигаться осторожно вперёд'];
}

function buildFallback(userPrompt, players) {
  const party = players.map(p => p.nickname).join(' и ') || 'Отряд';
  const lower = userPrompt.toLowerCase();

  // Respond directly to specific keywords
  if (/дроч|мастурб|секс|трах/.test(lower)) {
    return {
      narrative: `${party} решает заняться весьма... неожиданным делом прямо здесь, в сердце подземелья. Гоблин-часовой выглядывает из-за угла, хлопает себя по лбу и громко ругается на своём наречии. Шум привлекает внимание соратников — все смотрят на тебя с немым вопросом.`,
      checkRequired: { skill: 'Харизма / Самоконтроль (CHA)', dc: 8, description: 'Сохранить лицо перед отрядом' },
      suggestedActions: ['Сделать вид что ничего не было', 'Зарядить себя перед боем', 'Убежать в тёмный коридор']
    };
  }

  if (/открыт.*сундук|сундук.*открыт/.test(lower)) {
    return {
      narrative: `Ты решительно подступаешь к сундуку. Старый замок поддаётся с хрустом — внутри поблёскивает горсть золотых монет, свёрнутый пергамент и странный флакон с фиолетовой жидкостью!`,
      checkRequired: { skill: 'Анализ (Investigation)', dc: 11, description: 'Определить что за флакон' },
      suggestedActions: ['Забрать золото и флакон', 'Прочитать пергамент', 'Осторожно понюхать флакон']
    };
  }

  if (/атак|нападаю|удар|бью|режу|рублю/.test(lower)) {
    return {
      narrative: `Ты бросаешься в атаку: ${userPrompt}! Противник реагирует — он уклоняется и наносит ответный удар. Вокруг звенит сталь, товарищи занимают боевые позиции!`,
      checkRequired: { skill: 'Атака (STR или DEX)', dc: 14, description: 'Попасть по цели' },
      suggestedActions: ['Нанести второй удар', 'Отступить за союзника', 'Использовать специальную атаку']
    };
  }

  if (/прируч|подружиться|говор.*гоблин|гоблин.*говор/.test(lower)) {
    return {
      narrative: `Ты пытаешься наладить контакт. Гоблин с удивлением смотрит на тебя — таких дерзких авантюристов он ещё не видел. Он медленно опускает ятаган и выжидающе щурится.`,
      checkRequired: { skill: 'Убеждение / Обман (CHA)', dc: 13, description: 'Склонить гоблина к диалогу' },
      suggestedActions: ['Предложить ему еду', 'Пообещать золото', 'Произнести его имя по-гоблински']
    };
  }

  if (/иду|двигаюсь|прохожу|захожу|выхожу|бегу/.test(lower)) {
    return {
      narrative: `${party} продвигается вперёд. Впереди коридор разветвляется: левый уходит вниз в темноту, из правого тянет запахом дыма и слышен лязг металла.`,
      checkRequired: { skill: 'Внимательность (Perception)', dc: 12, description: 'Заметить признаки опасности' },
      suggestedActions: ['Пойти в левый коридор', 'Осторожно заглянуть вправо', 'Остановиться и прислушаться']
    };
  }

  // Generic catch-all — always includes the player's exact action
  const genericResponses = [
    `${party} совершает действие: "${userPrompt}". Подземелье реагирует мгновенно — камни под ногами слегка вздрагивают, где-то вдалеке слышен глухой удар. Кажется, ваши действия не остались незамеченными...`,
    `Ты делаешь попытку: "${userPrompt}". Удача на твоей стороне — обстановка меняется! Из тени выступает фигура в плаще и жестом указывает на дверь с горящими рунами.`,
    `"${userPrompt}" — дерзко! Мастер делает пометку. Слышен скрежет механизма: что-то активировалось. ${party} чувствует дуновение магии.`
  ];

  return {
    narrative: genericResponses[Math.floor(Math.random() * genericResponses.length)],
    checkRequired: { skill: 'Внимательность (Perception)', dc: 12, description: 'Оценить последствия действия' },
    suggestedActions: defaultActions(userPrompt)
  };
}
