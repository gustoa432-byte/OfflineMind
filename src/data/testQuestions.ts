export interface BenchmarkQuestion {
  id: string;
  question: string;
  category: string;
  expectedKeywords: string[];
  descriptionRu: string;
}

export const TEST_BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  {
    id: 'q1',
    question: 'Чем площадь отличается от периметра?',
    category: 'Геометрия',
    expectedKeywords: ['периметр', 'площадь', 'длина', 'квадратных'],
    descriptionRu: 'Различие линейной и двумерной мер'
  },
  {
    id: 'q2',
    question: 'Сколько метров в дециметре?',
    category: 'Единицы длины',
    expectedKeywords: ['0,1', '0.1', 'десятая'],
    descriptionRu: 'Дольная единица метра (1 дм = 0.1 м)'
  },
  {
    id: 'q3',
    question: 'Что такое сотка и сколько в ней квадратных метров?',
    category: 'Меры площади',
    expectedKeywords: ['100', 'ар', 'квадратных метров'],
    descriptionRu: 'Определение сотки земли (100 м²)'
  },
  {
    id: 'q4',
    question: 'Чем акр отличается от гектара?',
    category: 'Меры площади',
    expectedKeywords: ['гектар', 'акр', '10 000', '4046', 'больше'],
    descriptionRu: 'Соотношение акра и гектара (1 га ≈ 2.47 акра)'
  },
  {
    id: 'q5',
    question: 'Как называется число, которое делят?',
    category: 'Арифметика',
    expectedKeywords: ['делимое'],
    descriptionRu: 'Компоненты деления: делимое'
  },
  {
    id: 'q6',
    question: 'Как называется число, на которое делят?',
    category: 'Арифметика',
    expectedKeywords: ['делитель'],
    descriptionRu: 'Компоненты деления: делитель'
  },
  {
    id: 'q7',
    question: 'Как называется результат деления?',
    category: 'Арифметика',
    expectedKeywords: ['частное'],
    descriptionRu: 'Результат операции деления'
  },
  {
    id: 'q8',
    question: 'Как называется число, из которого вычитают?',
    category: 'Арифметика',
    expectedKeywords: ['уменьшаемое'],
    descriptionRu: 'Первый компонент вычитания'
  },
  {
    id: 'q9',
    question: 'Как называется число, которое вычитают?',
    category: 'Арифметика',
    expectedKeywords: ['вычитаемое'],
    descriptionRu: 'Второй компонент вычитания'
  },
  {
    id: 'q10',
    question: 'Чем радиус отличается от диаметра?',
    category: 'Геометрия',
    expectedKeywords: ['половина', '2', 'центр', 'диаметр'],
    descriptionRu: 'Связь радиуса и диаметра окружности'
  },
  {
    id: 'q11',
    question: 'Что такое гипотенуза и катеты?',
    category: 'Геометрия',
    expectedKeywords: ['прямоугольн', 'прямой угол', 'длинная', 'пифагор'],
    descriptionRu: 'Стороны прямоугольного треугольника'
  },
  {
    id: 'q12',
    question: 'Сколько литров в одном кубическом метре?',
    category: 'Объём',
    expectedKeywords: ['1000', 'тысяча'],
    descriptionRu: 'Соотношение литра и м³ (1 м³ = 1000 л)'
  },
  {
    id: 'q13',
    question: 'Чем масса отличается от веса?',
    category: 'Масса и сила',
    expectedKeywords: ['ньютон', 'килограмм', 'сила', 'опору', 'гравитаци'],
    descriptionRu: 'Масса (кг, скаляр) vs Вес (Н, сила на опору)'
  },
  {
    id: 'q14',
    question: 'Сколько килограммов в одном центнере?',
    category: 'Единицы массы',
    expectedKeywords: ['100', 'сто'],
    descriptionRu: 'Метрический центнер (1 ц = 100 кг)'
  },
  {
    id: 'q15',
    question: 'Сколько килограммов в одной тонне?',
    category: 'Единицы массы',
    expectedKeywords: ['1000', 'тысяча'],
    descriptionRu: 'Тонна в килограммах (1 т = 1000 кг)'
  },
  {
    id: 'q16',
    question: 'Сколько килограммов в одном пуде?',
    category: 'Исторические меры',
    expectedKeywords: ['16', '16,38', '16.38'],
    descriptionRu: 'Старинный русский пуд (~16.38 кг)'
  },
  {
    id: 'q17',
    question: 'Чем скорость отличается от ускорения?',
    category: 'Кинематика',
    expectedKeywords: ['быстрота', 'разгон', 'м/с', 'м/с²'],
    descriptionRu: 'Скорость (изменение координаты) vs ускорение'
  },
  {
    id: 'q18',
    question: 'Сколько сантиметров в одном дюйме?',
    category: 'Английские меры',
    expectedKeywords: ['2,54', '2.54'],
    descriptionRu: 'Точный международный дюйм (2.54 см)'
  },
  {
    id: 'q19',
    question: 'Сколько сантиметров в одном футе?',
    category: 'Английские меры',
    expectedKeywords: ['30,48', '30.48', '12 дюйм'],
    descriptionRu: 'Фут в сантиметрах (30.48 см)'
  },
  {
    id: 'q20',
    question: 'Что такое промилле и сколько их в проценте?',
    category: 'Арифметика',
    expectedKeywords: ['10', 'тысячная', 'сотая'],
    descriptionRu: 'Соотношение процента и промилле (1% = 10‰)'
  },
  {
    id: 'q21',
    question: 'Как называется результат умножения чисел?',
    category: 'Арифметика',
    expectedKeywords: ['произведение'],
    descriptionRu: 'Результат умножения'
  },
  {
    id: 'q22',
    question: 'Как называется результат сложения чисел?',
    category: 'Арифметика',
    expectedKeywords: ['сумма'],
    descriptionRu: 'Результат сложения'
  },
  {
    id: 'q23',
    question: 'Сколько соток в одном гектаре?',
    category: 'Меры площади',
    expectedKeywords: ['100', 'сто'],
    descriptionRu: 'Гектар в сотках (1 га = 100 соток)'
  },
  {
    id: 'q24',
    question: 'Что такое аршин и сколько он составляет?',
    category: 'Исторические меры',
    expectedKeywords: ['71', '71,12', 'см'],
    descriptionRu: 'Русский аршин (~71.12 см)'
  },
  {
    id: 'q25',
    question: 'Сколько метров в одном километре?',
    category: 'Единицы длины',
    expectedKeywords: ['1000', 'тысяча'],
    descriptionRu: 'Километр в метрах'
  },
  {
    id: 'q26',
    question: 'Чем объем отличается от площади?',
    category: 'Геометрия',
    expectedKeywords: ['кубическ', 'квадратн', 'трехмерн', 'двумерн'],
    descriptionRu: 'Двумерное покрытие vs трехмерное пространство'
  },
  {
    id: 'q27',
    question: 'Чему равен объем куба со стороной 3 метра?',
    category: 'Геометрия',
    expectedKeywords: ['27', 'кубических'],
    descriptionRu: 'Расчет объема куба (V = 3³ = 27 м³)'
  },
  {
    id: 'q28',
    question: 'Сколько граммов в одном килограмме?',
    category: 'Единицы массы',
    expectedKeywords: ['1000', 'тысяча'],
    descriptionRu: 'Килограмм в граммах'
  },
  {
    id: 'q29',
    question: 'Сколько секунд в одном часе?',
    category: 'Единицы времени',
    expectedKeywords: ['3600', '60'],
    descriptionRu: 'Час в секундах (60 × 60 = 3600 с)'
  },
  {
    id: 'q30',
    question: 'Как перевести метры в секунду в километры в час?',
    category: 'Скорость',
    expectedKeywords: ['3,6', '3.6', 'умножить'],
    descriptionRu: 'Коэффициент пересчета 1 м/с = 3.6 км/ч'
  }
];
