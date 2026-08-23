const axios = require('axios');

/**
 * AI Dungeon Master Service
 * Provides free AI storytelling and D&D 5e Master response generation.
 * Default AI engine: Pollinations AI (100% free, no API key required)
 * Fallback / Custom: OpenRouter free models, Gemini, Groq, or custom keys.
 */

const SYSTEM_PROMPT = `
Ты — опытный, захватывающий и справедливый Мастер Подземелий (Dungeon Master) в игре Dungeons & Dragons 5e.
Твоя задача — вести увлекательную кампанию для группы игроков на русском языке.

ПРАВИЛА И СТИЛЬ ВЕДЕНИЯ:
1. Описывай сцены красочно, с атмосферой фэнтези (звуки, запахи, освещение, ощущение опасности или тайны).
2. Задавай динамичный темп. Давай игрокам четкие возможности выбора и действий.
3. Отслеживай результаты бросков D20:
   - При броске D20 учитывай Сложность (DC) или Класс Брони (AC).
   - При 20 (Критический успех): Описывай эпический, триумфальный момент!
   - При 1 (Критический провал): Описывай забавную или конфузную неудачу (без нечестного убийства персонажа).
4. Если действие требует проверки навыка, напиши в скобках специальный маркер проверки, например: [CHECK: Внимательность, DC: 12] или [CHECK: Атлетика, DC: 14].
5. Отвечай от имени Мастера (DM). Оформляй диалоги монстров и NPC с характером.
6. В конце каждого своего хода задавай вопрос игрокам: "Что вы делаете?" и приводи 3 возможных варианта действий (или свободный ввод).

ФОРМАТ ОТВЕТА (JSON):
Выдавай ответ строго в формате JSON со следующей структурой:
{
  "narrative": "Красочный текст повествования Мастера на русском языке...",
  "checkRequired": null или { "skill": "Внимательность", "dc": 14, "description": "Проверка для обнаружения ловушки" },
  "suggestedActions": [
    "Осмотреть сундук на наличие ловушек",
    "Прокрасться мимо спящего гоблина",
    "Окликнуть неизвестную фигуру в плаще"
  ],
  "soundEffect": "dungeon_ambient" // или "battle", "victory", "mystery", "dice_roll"
}
`;

async function generateDmResponse({ prompt, gameContext, apiKey = null, provider = 'pollinations', model = 'meta-llama/llama-3.3-70b-instruct:free' }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Контекст партии:\nЛокация/Сценарий: ${gameContext.scenario || 'Кабак "Пьяный Дракон" и загадочная подземелье под ним'}\nИгроки в лобби: ${JSON.stringify(gameContext.players || [])}\nПоследние события:\n${(gameContext.history || []).slice(-6).map(h => `${h.sender}: ${h.text}`).join('\n')}\n\nНовое действие/сообщение от игроков:\n${prompt}\n\nДай ответ от имени Мастера Подземелий в JSON формате.`
    }
  ];

  // Provider 1: OpenRouter (if user has key or uses free models)
  if (provider === 'openrouter' || apiKey) {
    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: model || 'meta-llama/llama-3.3-70b-instruct:free',
        messages: messages,
        response_format: { type: 'json_object' },
        temperature: 0.8
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey || 'free'}`,
          'HTTP-Referer': 'https://dnd-ai-game.local',
          'X-Title': 'DnD AI Game',
          'Content-Type': 'application/json'
        },
        timeout: 25000
      });

      const content = response.data.choices[0].message.content;
      return parseAiJson(content);
    } catch (err) {
      console.warn('OpenRouter request failed, falling back to Pollinations AI:', err.message);
    }
  }

  // Provider 2: Pollinations.ai (Free, zero API key required)
  try {
    const pollinationsPayload = {
      messages: messages,
      model: 'openai',
      seed: Math.floor(Math.random() * 100000),
      jsonMode: true
    };

    const response = await axios.post('https://text.pollinations.ai/', pollinationsPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000
    });

    let rawData = response.data;
    if (typeof rawData === 'object' && rawData.choices && rawData.choices[0]) {
      rawData = rawData.choices[0].message.content;
    }

    return parseAiJson(typeof rawData === 'string' ? rawData : JSON.stringify(rawData));
  } catch (err) {
    console.error('Pollinations AI failed, generating offline DM fallback:', err.message);
    return getOfflineDmResponse(prompt, gameContext);
  }
}

function parseAiJson(rawString) {
  try {
    // Clean codeblocks if model wrapped output in markdown ```json ... ```
    let cleaned = rawString.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      narrative: parsed.narrative || "Мастер задумчиво кивает и ждет вашего следующего хода...",
      checkRequired: parsed.checkRequired || null,
      suggestedActions: parsed.suggestedActions || ["Исследовать дальше", "Приготовиться к бою", "Спросить Мастера"],
      soundEffect: parsed.soundEffect || "mystery"
    };
  } catch (e) {
    console.warn("Failed to parse JSON from AI response, returning raw narrative fallback:", e.message);
    return {
      narrative: rawString || "Мастер таинственно смотрит в темноту подземелья...",
      checkRequired: null,
      suggestedActions: ["Продолжить путь", "Бросить D20", "Осмотреться"],
      soundEffect: "mystery"
    };
  }
}

function getOfflineDmResponse(prompt, gameContext) {
  const sampleNarratives = [
    "Эхо ваших шагов разносится по старинному каменному коридору. Впереди виднеется тусклый свет факелов и слышен подозрительный шорох.",
    "Факел слегка вспыхивает, озаряя древние руны на стене. Кажется, это подземелье хранит забытые сокровища... или смертельные ловушки.",
    "Тень метнулась за колонной! Из мрака выходят два гоблина с ржавыми мечами, скаля острые зубы!",
    "Вы находите резной дубовый сундук с железной оковкой. На замке выгравирован символ дракона."
  ];
  const chosenNarrative = sampleNarratives[Math.floor(Math.random() * sampleNarratives.length)];

  return {
    narrative: `${chosenNarrative} (Ответ игрока: "${prompt}")`,
    checkRequired: Math.random() > 0.5 ? { skill: "Внимательность (Perception)", dc: 12, description: "Проверка на ловушки" } : null,
    suggestedActions: [
      "Осмотреть окрестности (Бросить D20 на Внимательность)",
      "Обнажить оружие и занять боевую стойку",
      "Осторожно продвинуться вперед"
    ],
    soundEffect: "dungeon_ambient"
  };
}

module.exports = {
  generateDmResponse
};
