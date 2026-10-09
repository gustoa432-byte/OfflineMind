import { VERIFIED_KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { KnowledgeEntry } from '../types';

export interface SearchMatch {
  entry: KnowledgeEntry;
  score: number;
  matchType: 'exact_keyword' | 'synonym' | 'content_match' | 'fuzzy';
  matchedQueryTerm?: string;
}

// Synonyms and colloquial intent mapping for non-exact queries
const INTENT_SYNONYMS: Record<string, string[]> = {
  area_vs_perimeter: [
    'площадь', 'периметр', 'забор', 'трава', 'разница площадь периметр',
    'чем отличается площадь', 'чем отличается периметр', 'периметр и площадь разница',
    'квадратные метры и метры'
  ],
  meter_vs_decimeter: [
    'дециметр', 'дм', 'дециметре', 'метре', 'сколько метров в дециметре',
    'сколько сантиметров в дециметре', 'метр дециметр', '1 дм'
  ],
  sotka_ar: [
    'сотка', 'сотке', 'сотки', 'сотка земли', 'ар', 'что такое сотка',
    'сколько в сотке', 'сколько квадратных метров в сотке', '100 метров'
  ],
  acre_vs_hectare: [
    'акр', 'гектар', 'акре', 'гектаре', 'чем акр отличается от гектара',
    'акр или гектар', 'что больше акр или гектар', 'соток в гектаре', 'соток в акре'
  ],
  dividend_divisor_quotient: [
    'число которое делят', 'число на которое делят', 'делимое', 'делитель',
    'частное', 'как называется число которое делят', 'компоненты деления', 'деление'
  ],
  subtraction_components: [
    'уменьшаемое', 'вычитаемое', 'разность', 'число из которого вычитают',
    'число которое вычитают', 'минус', 'компоненты вычитания'
  ],
  multiplication_components: [
    'множитель', 'произведение', 'результат умножения', 'числа которые умножают',
    'умножение'
  ],
  addition_components: [
    'слагаемое', 'сумма', 'результат сложения', 'числа которые складывают', 'плюс'
  ],
  radius_vs_diameter: [
    'радиус', 'диаметр', 'круг', 'окружность', 'центр круга', 'половина диаметра'
  ],
  hypotenuse_vs_leg: [
    'гипотенуза', 'катет', 'катеты', 'сторона прямоугольного треугольника',
    'прямой угол', 'теорема пифагора', 'самая длинная сторона'
  ],
  volume_vs_area: [
    'объем', 'площадь и объем', 'кубические метры', 'разница объем площадь'
  ],
  liter_cubic_meter: [
    'литр', 'кубический метр', 'куб воды', 'сколько литров в кубе', 'дм3'
  ],
  mass_vs_weight: [
    'масса', 'вес', 'чем масса отличается от веса', 'луна', 'невесомость', 'ньютон', 'кг'
  ],
  mass_units_metric: [
    'центнер', 'тонна', 'грамм', 'килограмм', 'сколько в центнере кг', 'сколько в тонне'
  ],
  old_russian_units: [
    'пуд', 'сажень', 'аршин', 'вершок', 'сколько в пуде', 'пуд соли'
  ],
  speed_vs_acceleration: [
    'скорость', 'ускорение', 'чем скорость отличается от ускорения', 'разгон'
  ],
  anglo_length_units: [
    'дюйм', 'фут', 'ярд', 'миля', 'сколько см в дюйме', 'дюймы'
  ],
  percent_vs_promille: [
    'процент', 'промилле', 'сотая часть', 'тысячная часть'
  ]
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches the verified offline knowledge base without running an LLM.
 * Returns results ranked by match relevance score in < 15ms.
 */
export function searchKnowledgeBase(query: string): SearchMatch[] {
  const normQuery = normalizeText(query);
  if (!normQuery) {
    return [];
  }

  const queryTokens = normQuery.split(' ').filter(t => t.length > 2);
  const results: SearchMatch[] = [];

  for (const entry of VERIFIED_KNOWLEDGE_BASE) {
    let score = 0;
    let matchType: SearchMatch['matchType'] = 'fuzzy';
    let matchedQueryTerm = '';

    const normTitle = normalizeText(entry.canonicalTitle);
    const normDef = normalizeText(entry.definition);
    const normExpl = normalizeText(entry.simpleExplanation);

    // 1. Direct query match in keywords
    for (const kw of entry.keywords) {
      const normKw = normalizeText(kw);
      if (normQuery === normKw || normQuery.includes(normKw)) {
        score += 100;
        matchType = 'exact_keyword';
        matchedQueryTerm = kw;
        break;
      }
      if (normKw.includes(normQuery)) {
        score += 80;
        matchType = 'exact_keyword';
        matchedQueryTerm = kw;
      }
    }

    // 2. Intent synonyms mapping check
    const synonyms = INTENT_SYNONYMS[entry.id] || [];
    for (const syn of synonyms) {
      const normSyn = normalizeText(syn);
      if (normQuery === normSyn || normQuery.includes(normSyn)) {
        score += 90;
        if (matchType !== 'exact_keyword') matchType = 'synonym';
        matchedQueryTerm = syn;
        break;
      }
      if (normSyn.includes(normQuery)) {
        score += 70;
        if (matchType !== 'exact_keyword') matchType = 'synonym';
      }
    }

    // 3. Token-level overlap
    for (const token of queryTokens) {
      if (normTitle.includes(token)) {
        score += 35;
      }
      for (const kw of entry.keywords) {
        if (kw.toLowerCase().includes(token)) {
          score += 25;
        }
      }
      if (normDef.includes(token)) {
        score += 15;
      }
      if (normExpl.includes(token)) {
        score += 10;
      }
    }

    // 4. Do not confuse with check
    if (entry.doNotConfuseWith) {
      const confTerm = normalizeText(entry.doNotConfuseWith.term);
      if (queryTokens.some(t => confTerm.includes(t))) {
        score += 20;
      }
    }

    if (score > 15) {
      results.push({
        entry,
        score,
        matchType,
        matchedQueryTerm: matchedQueryTerm || entry.canonicalTitle
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Builds the strict factual RAG context to supply to the local LLM.
 */
export function buildLLMPrompt(query: string, match?: KnowledgeEntry): { systemPrompt: string; userPrompt: string } {
  if (match) {
    const systemPrompt = `Ты — встроенный русскоязычный офлайн-помощник знаний в приложении «Offline Knowledge» на Android.
Твоя задача: объяснить понятие понятным человеческим языком без заумных фраз, опираясь СТРОГО на предоставленную проверенную запись базы данных.
Не выдумывай факты и коэффициенты пересчёта.

СТРОГИЕ ПРОВЕРЕННЫЕ ДАННЫЕ ИЗ БАЗЫ:
• Каноническое понятие: ${match.canonicalTitle}
• Определение: ${match.definition}
• Простое объяснение: ${match.simpleExplanation}
• Примеры: ${match.examples.join('; ')}
${match.doNotConfuseWith ? `• НЕ ПУТАТЬ С: ${match.doNotConfuseWith.term}. Различие: ${match.doNotConfuseWith.difference}` : ''}
${match.formulas && match.formulas.length > 0 ? `• Формулы / соотношения: ${match.formulas.join('; ')}` : ''}
• Источник: ${match.source}

ФОРМАТ ОТВЕТА:
1. Краткий прямой ответ на вопрос (1-2 предложения).
2. Простое объяснение «на пальцах» или жизненный пример.
3. Важное предостережение («Не путайте с...»), если применимо.`;

    const userPrompt = `Вопрос пользователя: «${query}». Объясни мне это простыми словами.`;
    return { systemPrompt, userPrompt };
  }

  // If no entry matched in verified database
  const systemPrompt = `Ты — встроенный русскоязычный офлайн-помощник знаний в приложении «Offline Knowledge» на Android.
Внимание: по данному запросу точная статья в проверенной локальной базе не найдена.
Дай краткий, точный ответ на русском языке по базовым понятиям математики, физики или терминологии.
В начале ответа обязательно укажи, что термин отсутствует в проверенной базе приложения, но ты даёшь общепринятое научное определение.`;

  const userPrompt = `Вопрос пользователя: «${query}». Ответь кратко и понятно.`;
  return { systemPrompt, userPrompt };
}
