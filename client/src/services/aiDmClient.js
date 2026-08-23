/**
 * Client-Side AI Dungeon Master Engine
 * Free storytelling powered by Pollinations GET AI (100% free, no 402/429 limits) & RPG Generator
 */

export async function fetchAiDmNarrative({ prompt, history = [], players = [], apiKey = null, provider = 'pollinations' }) {
  const systemContext = `Ты — опытный Мастер Подземелий (Dungeon Master) в игре Dungeons & Dragons 5e. Описывай сцены на русском языке красочно, давай варианты действий и запрашивай проверки D20 при необходимости.`;
  const fullPrompt = `${systemContext}\n\nКонтекст подземелья:\nИгроки: ${players.map(p => p.nickname).join(', ')}\nИстория: ${history.slice(-4).map(h => h.text).join(' | ')}\n\nДействие игрока: ${prompt}\n\nОпиши реакцию Мастера:`;

  // 1. Try Pollinations GET API (unlimited free tier, no 402/429 rate limits)
  try {
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai&seed=${seed}`;
    
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 10 && !text.includes('Payment Required')) {
        return parseNarrativeResponse(text, prompt);
      }
    }
  } catch (e) {
    console.warn("Pollinations GET API warning:", e.message);
  }

  // 2. Try OpenRouter free tier if key provided
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
          messages: [{ role: 'system', content: systemContext }, { role: 'user', content: fullPrompt }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices[0].message.content;
        return parseNarrativeResponse(text, prompt);
      }
    } catch (e) {
      console.warn("OpenRouter fetch warning:", e.message);
    }
  }

  // 3. Fallback Dynamic D&D RPG Story Engine
  return generateDynamicRpgNarrative(prompt, players);
}

function parseNarrativeResponse(rawText, userPrompt) {
  // Extract potential DC checks or actions
  let checkRequired = null;
  if (rawText.toLowerCase().includes('проверк') || rawText.toLowerCase().includes('бросок') || rawText.toLowerCase().includes('d20')) {
    checkRequired = { skill: "Внимательность (Perception)", dc: 12, description: "Проверка результата действия" };
  }

  return {
    narrative: rawText,
    checkRequired,
    suggestedActions: [
      "Осмотреть локацию подробнее",
      "Приготовиться к возможному бою",
      "Осторожно продвинуться вперед"
    ]
  };
}

function generateDynamicRpgNarrative(userPrompt, players) {
  const partyNames = players.map(p => p.nickname).join(' и ');
  const templates = [
    {
      text: `Мастер задумчиво прищуривается. Ваша попытка "${userPrompt}" заставляет эхо разноситься по мрачному залу подземелья. В тени за факелом что-то зловеще пошевелилось!`,
      actions: ["Оснастить оружие и занять боевую стойку", "Зажечь факел и осмотреть тень", "Присесть и прокрасться тихо"],
      check: { skill: "Внимательность (Perception)", dc: 13, description: "Обнаружение врагов в тени" }
    },
    {
      text: `Каменные руны на полу подземелья на мгновение вспыхивают тусклым синим светом в ответ на действие "${userPrompt}". Воздух наполняется запахом древней магии и озона.`,
      actions: ["Изучить древние руны (Проверка Магии)", "Отойти на безопасное расстояние", "Попросить мага расшифровать символ"],
      check: { skill: "Магия (Arcana)", dc: 12, description: "Расшифровка магии рун" }
    },
    {
      text: `Группа (${partyNames || 'Отряд'}) внимательно следит за обстановкой. Вы предпринимаете действие: "${userPrompt}". Впереди открывается старинный сундук со сгнившими оковками.`,
      actions: ["Осмотреть сундук на ловушки (Бросить D20)", "Попытаться открыть замок", "Окликнуть соратников"],
      check: { skill: "Анализ (Investigation)", dc: 11, description: "Поиск ловушек на сундуке" }
    }
  ];

  const picked = templates[Math.floor(Math.random() * templates.length)];
  return {
    narrative: picked.text,
    checkRequired: picked.check,
    suggestedActions: picked.actions
  };
}
