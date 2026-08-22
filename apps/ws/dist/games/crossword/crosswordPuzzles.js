/**
 * Встроенные сетки: буквы в строках совпадают с ответами (пересечения подсказывают при вводе и после угадывания).
 * Формат: grid — решение ('.' пусто в шаблоне не используем внутри слова, '#' блок), clues — подсказки.
 */
export const CROSSWORD_PUZZLES = [
  {
    grid: ['КОТ..', 'ОТ...', 'Л....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Домашний питомец, мурлычет', answer: 'КОТ', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Столб, опора', answer: 'КОЛ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Предлог (откуда?)', answer: 'ОТ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['СНЕГ.', 'ЛЕ...', 'О....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Зимнее покрывало земли', answer: 'СНЕГ', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Начало слова «слон»', answer: 'СЛО', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Отрицание', answer: 'НЕ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['МИР..', 'УР...', 'Х....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Противоположность войне', answer: 'МИР', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Надоедливое насекомое', answer: 'МУХ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Начало названия реки Иртыш', answer: 'ИР', row: 0, col: 1 },
    ],
  },
  {
    grid: ['СОК..', 'ЛК...', 'О....', 'Н....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Напиток из фруктов', answer: 'СОК', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Большое животное с хоботом', answer: 'СЛОН', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Согласие (разг.)', answer: 'ОК', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ПИР..', 'АС...', 'Р....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Праздничный стол / застолье', answer: 'ПИР', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Горячий водяной пар', answer: 'ПАР', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Злой дух (миф.)', answer: 'ИС', row: 0, col: 1 },
    ],
  },
  {
    grid: ['НОС..', 'ОС...', 'ТА...', 'А....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Часть лица, которой дышим', answer: 'НОС', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Музыкальный знак; нота', answer: 'НОТА', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Кость (анат.)', answer: 'ОС', row: 0, col: 1 },
      { num: 4, dir: 'across', clue: 'Указательное «эта» (жен.)', answer: 'ТА', row: 2, col: 0 },
    ],
  },
  {
    grid: ['РОК..', 'УК...', 'Б....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Тяжёлая музыка с гитарами', answer: 'РОК', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Денежная единица (разг.)', answer: 'РУБ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: '«Всё в порядке»', answer: 'ОК', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ЛУК..', 'АК...', 'К....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Овощ круглый, пахучий', answer: 'ЛУК', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Покрытие блестящее (лак)', answer: 'ЛАК', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Сокращение (напр. «у кого»)', answer: 'УК', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ДУХ..', 'ОХ...', 'М....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Душа; запах', answer: 'ДУХ', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Жилище, здание', answer: 'ДОМ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Слух; «ух» как междометие', answer: 'УХ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['БАНК.', 'ИТ...', 'Т....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Кредитная организация; ряд (книг)', answer: 'БАНК', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Единица информации; кусочек', answer: 'БИТ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Предлог «к, по направлению»', answer: 'АТ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['СИЛА.', 'ОЛ...', 'Н....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Мощь; физическая величина', answer: 'СИЛА', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Сон, дремота', answer: 'СОН', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Река в Италии; сокращение', answer: 'ИЛ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ГОРА.', 'АР...', 'З....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Большой холм; вершина', answer: 'ГОРА', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Топливо; воздух', answer: 'ГАЗ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Логический оператор ИЛИ (програм.)', answer: 'ОР', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ЗИМА.', 'УМ...', 'Б....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Время года со снегом', answer: 'ЗИМА', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Твёрдый орган во рту', answer: 'ЗУБ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Местоимение «они» (кратк.)', answer: 'ИМ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ТРУБ.', 'ОУ...', 'П....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Для дыма или воды', answer: 'ТРУБ', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Верх, высшая точка', answer: 'ТОП', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Река в Европе (кратко)', answer: 'РУ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ЛУНА.', 'ЕХ...', 'Д....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Спутник Земли', answer: 'ЛУНА', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Замёрзшая вода', answer: 'ЛЕД', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Междометие сомнения', answer: 'УХ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['РАМА.', 'ОМ...', 'Д....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Оконная; кино-кадр', answer: 'РАМА', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Родня, семья', answer: 'РОД', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Предлог «утро» без у (шутл.)', answer: 'АМ', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ЧАС..', 'АСТ..', 'Т....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Шестьдесят минут', answer: 'ЧАС', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Онлайн-переписка', answer: 'ЧАТ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Союз «и» (уст., поэт.)', answer: 'АС', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ВОЛК.', 'ОК...', 'Р....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Хищный зверь; одержимый', answer: 'ВОЛК', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Тот, кто крадёт', answer: 'ВОР', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: '«Всё хорошо» (разг.)', answer: 'ОК', row: 0, col: 1 },
    ],
  },
  {
    grid: ['ПАУК.', 'УР...', 'Л....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Плетёт паутину', answer: 'ПАУК', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Патрон; пуля (разг.)', answer: 'ПУЛ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Предлог «к» (поэт., уст.)', answer: 'АР', row: 0, col: 1 },
    ],
  },
  {
    grid: ['КРАБ.', 'ОУ...', 'Т....', '.....', '.....'],
    clues: [
      { num: 1, dir: 'across', clue: 'Морской с панцирем', answer: 'КРАБ', row: 0, col: 0 },
      { num: 2, dir: 'down', clue: 'Пушистый друг, мяукает', answer: 'КОТ', row: 0, col: 0 },
      { num: 3, dir: 'down', clue: 'Река в Европе (кратко)', answer: 'РУ', row: 0, col: 1 },
    ],
  },
];
