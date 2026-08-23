/**
 * Client-Side Hardcore Adaptive AI Dungeon Master Engine
 * Maximum freedom: AI reacts dynamically to ANY player action, sentence, or crazy idea!
 */

const HARDCORE_DM_SYSTEM_PROMPT = `
Ты — Импровизационный и Радикальный Мастер Подземелий (Dungeon Master) в Dungeons & Dragons 5e.
ТВОЙ ГЛАВНЫЙ ПРИНЦИП: ПОЛНАЯ СВОБОДА ДЕЙСТВИЙ ИЖИВАЯ РЕАКЦИЯ НА ВСЁ, ЧТО СКАЖУТ ИЛИ СДЕЛАЮТ ИГРОКИ!

ПРАВИЛА РЕАКТИВНОГО ВЕДЕНИЯ:
1. Игроки могут делать и говорить АБСОЛЮТНО ВСЁ, ЧТО УГОДНО! (взорвать стену факелом, приручить гоблина, притвориться призраком, подкупить врага, обмануть дракона, сломать мечом замок).
2. НИКОГДА НЕ ЗАПРЕЩАЙ! Всегда используй правило D&D: "Ты можешь попробовать! Давай проверим броском D20".
3. МИР И СЮЖЕТ МЕНЯЮТСЯ ОТ КАЖДОГО СЛОВА ИГРОКА:
   - Сказали безумную идею? Мир реагирует мгновенно! Опиши последствия, шум, реакцию монстров и изменение окружения.
   - Разрушили что-то? Опиши обломки и открывшийся проход.
   - Попытались договориться? Дай шанс убеждения или обмана.
4. В конце своего ответа всегда предлагай 3 ДИНАМИЧЕСКИХ варианта развития событий, которые вытекают ИМЕННО из последнего нестандартного поступка игрока!
5. Если действие опасное или сложное — обязательно укажи проверку навыка в скобках [CHECK: Название Навыка, DC: число].
`;

export async function fetchAiDmNarrative({ prompt, history = [], players = [], apiKey = null }) {
  const fullPrompt = `${HARDCORE_DM_SYSTEM_PROMPT}\n\nКонтекст отряда:\nИгроки: ${players.map(p => `${p.nickname} (${p.characterClass})`).join(', ')}\nИстория последних событий:\n${history.slice(-4).map(h => `${h.sender}: ${h.text}`).join('\n')}\n\nНЕСТАНДАРТНОЕ ДЕЙСТВИЕ ИГРОКА: "${prompt}"\n\nОпиши реакцию Мастера и мира на это действие:`;

  // 1. Try Pollinations GET with seed & dynamic prompt
  try {
    const seed = Math.floor(Math.random() * 999999);
    const url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai&seed=${seed}`;
    
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 20 && !text.includes('Payment Required')) {
        return parseAdaptiveResponse(text, prompt);
      }
    }
  } catch (e) {
    console.warn("Pollinations fetch warning:", e.message);
  }

  // 2. OpenRouter fallback if API key provided
  if (apiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [{ role: 'system', content: HARDCORE_DM_SYSTEM_PROMPT }, { role: 'user', content: fullPrompt }],
          temperature: 0.9
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices[0].message.content;
        return parseAdaptiveResponse(text, prompt);
      }
    } catch (e) {
      console.warn("OpenRouter fetch warning:", e.message);
    }
  }

  // 3. Dynamic Improvised RPG Engine Fallback
  return generateImprovisedResponse(prompt, players);
}

function parseAdaptiveResponse(rawText, userPrompt) {
  let checkRequired = null;

  // Extract check DC if present
  const checkMatch = rawText.match(/\[CHECK:\s*([^,]+),\s*DC:\s*(\d+)\]/i);
  if (checkMatch) {
    checkRequired = {
      skill: checkMatch[1].trim(),
      dc: parseInt(checkMatch[2], 10),
      description: `Проверка для действия: "${userPrompt}"`
    };
  } else if (userPrompt.length > 3) {
    // Auto detect check needed for physical/magical/social actions
    const lower = userPrompt.toLowerCase();
    if (lower.includes('взорв') || lower.includes('слома') || lower.includes('удар') || lower.includes('атаку')) {
      checkRequired = { skill: "Атлетика / Сила", dc: 13, description: "Проверка физического воздействия" };
    } else if (lower.includes('убеди') || lower.includes('обман') || lower.includes('договор') || lower.includes('прируч')) {
      checkRequired = { skill: "Убеждение / Обман", dc: 14, description: "Проверка социального взаимодействия" };
    } else if (lower.includes('маги') || lower.includes('заклинания') || lower.includes('руны')) {
      checkRequired = { skill: "Магия (Arcana)", dc: 12, description: "Проверка концентрации и магии" };
    }
  }

  // Extract or generate dynamic suggested choices
  const suggestedActions = [
    `Воспользоваться последствиями своего действия: "${userPrompt.slice(0, 25)}..."`,
    "Бросить D20 на проверку успеха",
    "Приготовиться к непредсказуемой реакции окружения"
  ];

  return {
    narrative: rawText,
    checkRequired,
    suggestedActions
  };
}

function generateImprovisedResponse(userPrompt, players) {
  const partyNames = players.map(p => p.nickname).join(', ') || 'Отряд';

  const responses = [
    {
      text: `Мастер удивленно поднимает бровь! Идея "${userPrompt}" полностью меняет обстановку! Подземелье содрогается, факелы вспыхивают ярким светом, а из темного коридора доносится удивленный рык гоблинов.`,
      check: { skill: "Скрытность / Ловкость", dc: 13, description: "Реакция на неожиданный ход" },
      actions: [
        `Продолжить реализацию задумки: "${userPrompt.slice(0, 20)}"`,
        "Бросить D20 на проверку успеха",
        "Обнажить оружие и занять позицию"
      ]
    },
    {
      text: `Ваше неординарное действие "${userPrompt}" производит неожиданный эффект! Древние каменные плиты сдвигаются со скрежетом, открывая укрытый пылью тайный ход и древний алтарь.`,
      check: { skill: "Внимательность (Perception)", dc: 12, description: "Исследование нового тайного хода" },
      actions: [
        "Осмотреть открывшийся тайный проход",
        "Проверить алтарь на магические ловушки",
        "Окликнуть группу и двигаться вместе"
      ]
    },
    {
      text: `Вы делаете нестандартный ход: "${userPrompt}". Враги замирают в замешательстве, не ожидая такой дерзости! Один из гоблинов выдерживает паузу и колеблется, словно готов пойти на переговоры.`,
      check: { skill: "Обман / Убеждение (Charisma)", dc: 14, description: "Переговоры с врагами" },
      actions: [
        "Попытаться склонить гоблинов к миру (Бросить D20)",
        "Воспользоваться их замешательством и атаковать",
        "Предложить им золото или сделку"
      ]
    }
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}
