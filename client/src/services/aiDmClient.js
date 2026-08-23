/**
 * Client-Side AI Dungeon Master Engine
 * Direct storytelling using Pollinations AI (100% free, zero key needed) or OpenRouter
 */

const SYSTEM_PROMPT = `
Ты — опытный, захватывающий и справедливый Мастер Подземелий (Dungeon Master) в игре Dungeons & Dragons 5e.
Твоя задача — вести увлекательную кампанию для группы игроков на русском языке.

ПРАВИЛА И СТИЛЬ ВЕДЕНИЯ:
1. Описывай сцены красочно, с атмосферой фэнтези (звуки, запахи, освещение, ощущение опасности или тайны).
2. Задавай динамичный темп. Давай игрокам четкие возможности выбора и действий.
3. Отслеживай результаты бросков D20:
   - При броске D20 учитывай Сложность (DC) или Класс Брони (AC).
   - При 20 (Критический успех): Описывай эпический момент!
   - При 1 (Критический провал): Описывай забавную или конфузную неудачу.
4. Если действие требует проверки навыка, укажи проверку в объекте JSON.
5. Отвечай от имени Мастера (DM).
6. Приводи 3 возможных варианта действий.

ФОРМАТ ОТВЕТА (JSON):
{
  "narrative": "Красочный текст повествования Мастера на русском языке...",
  "checkRequired": null или { "skill": "Внимательность", "dc": 12, "description": "Проверка ловушки" },
  "suggestedActions": [
    "Осмотреть сундук на наличие ловушек",
    "Прокрасться мимо спящего гоблина",
    "Окликнуть неизвестную фигуру в плаще"
  ]
}
`;

export async function fetchAiDmNarrative({ prompt, history = [], players = [], apiKey = null, provider = 'pollinations' }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Контекст партии:\nИгроки: ${JSON.stringify(players.map(p => ({ name: p.nickname, class: p.characterClass })))}\nПоследние события:\n${history.slice(-6).map(h => `${h.sender}: ${h.text}`).join('\n')}\n\nНовое действие от игрока:\n${prompt}\n\nДай ответ от имени Мастера Подземелий в JSON формате.`
    }
  ];

  // Try OpenRouter if key is set
  if (apiKey || provider === 'openrouter') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey || 'free'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: messages,
          response_format: { type: 'json_object' }
        })
      });
      const data = await res.json();
      const content = data.choices[0].message.content;
      return parseJson(content);
    } catch (e) {
      console.warn("OpenRouter fetch failed, switching to Pollinations AI fallback:", e.message);
    }
  }

  // Pollinations.ai (Free, zero API key required)
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages,
        model: 'openai',
        jsonMode: true
      })
    });
    let raw = await res.text();
    return parseJson(raw);
  } catch (e) {
    console.error("Pollinations failed, returning offline fallback:", e.message);
    return getOfflineFallback(prompt);
  }
}

function parseJson(rawString) {
  try {
    let cleaned = rawString.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      narrative: parsed.narrative || "Мастер таинственно кивает и ожидает действий вашей группы...",
      checkRequired: parsed.checkRequired || null,
      suggestedActions: parsed.suggestedActions || ["Исследовать дальше", "Приготовиться к бою", "Осмотреть руны"]
    };
  } catch (e) {
    return {
      narrative: rawString || "Факелы тускло озаряют каменные своды подземелья...",
      checkRequired: null,
      suggestedActions: ["Продолжить путь", "Бросить D20", "Осмотреться"]
    };
  }
}

function getOfflineFallback(prompt) {
  return {
    narrative: `Древние стены подземелья отзываются эхом на ваше действие: "${prompt}". Впереди виднеется таинственная резная дверь с пылающими рунами.`,
    checkRequired: { skill: "Внимательность (Perception)", dc: 12, description: "Проверка тайной двери" },
    suggestedActions: [
      "Осмотреть дверные руны (Бросить D20)",
      "Обнажить оружие и занять боевую стойку",
      "Осторожно постучать по двери"
    ]
  };
}
