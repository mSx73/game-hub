export class RoleBalancer {
  static getRecommendedConfig(playerCount) {
    const configs = {
      6: { mafia: 2, sheriffs: 1, doctors: 0, maniacs: 0, poisoners: 0, putanas: 0 },
      7: { mafia: 2, sheriffs: 1, doctors: 1, maniacs: 0, poisoners: 0, putanas: 0 },
      8: { mafia: 2, sheriffs: 1, doctors: 1, maniacs: 1, poisoners: 0, putanas: 0 },
      9: { mafia: 2, sheriffs: 1, doctors: 1, maniacs: 1, poisoners: 0, putanas: 1 },
      10: { mafia: 2, sheriffs: 1, doctors: 1, maniacs: 1, poisoners: 0, putanas: 1 },
      11: { mafia: 3, sheriffs: 1, doctors: 1, maniacs: 1, poisoners: 0, putanas: 1 },
      12: { mafia: 3, sheriffs: 1, doctors: 1, maniacs: 1, poisoners: 1, putanas: 1 },
      13: { mafia: 3, sheriffs: 1, doctors: 1, maniacs: 1, poisoners: 1, putanas: 2 },
      14: { mafia: 3, sheriffs: 2, doctors: 1, maniacs: 1, poisoners: 1, putanas: 2 },
      15: { mafia: 3, sheriffs: 2, doctors: 2, maniacs: 2, poisoners: 1, putanas: 2 },
      16: { mafia: 4, sheriffs: 2, doctors: 1, maniacs: 2, poisoners: 1, putanas: 2 },
      17: { mafia: 4, sheriffs: 2, doctors: 2, maniacs: 2, poisoners: 1, putanas: 2 },
      18: { mafia: 4, sheriffs: 2, doctors: 2, maniacs: 2, poisoners: 1, putanas: 3 },
      19: { mafia: 4, sheriffs: 2, doctors: 2, maniacs: 2, poisoners: 2, putanas: 3 },
      20: { mafia: 4, sheriffs: 2, doctors: 2, maniacs: 2, poisoners: 2, putanas: 3 },
    };
    return configs[playerCount] ?? this.scaleConfig(playerCount);
  }
  static scaleConfig(count) {
    const mafia = Math.floor(count / 4);
    return {
      mafia: Math.min(mafia, 5),
      sheriffs: Math.min(2, Math.floor(count / 8)),
      doctors: Math.min(2, Math.floor(count / 10)),
      maniacs: Math.min(2, Math.floor(count / 10)),
      poisoners: count > 12 ? 1 : 0,
      putanas: Math.min(3, Math.floor(count / 6)),
    };
  }
  static validateConfig(config, playerCount) {
    const totalRoles =
      config.mafia + config.sheriffs + config.doctors + config.maniacs + config.poisoners + config.putanas;
    if (totalRoles > playerCount) {
      return `Слишком много ролей (${totalRoles}) для ${playerCount} игроков`;
    }
    if (config.mafia === 0) return 'Нужна хотя бы 1 мафия';
    if (config.mafia >= playerCount / 2) return 'Слишком много мафии';
    if (config.maniacs > 0 && playerCount < 8) return 'Маньяк нужен минимум для 8 игроков';
    if (config.poisoners > 0 && playerCount < 12) return 'Отравитель нужен минимум для 12 игроков';
    return null;
  }
  static getRoleDescription(role) {
    const descriptions = {
      civilian: {
        name: 'Мирный житель',
        description: 'Спит ночью, голосует днём. Побеждает, если изгнать всех мафий.',
        team: 'Мирные',
        icon: '👨‍🌾',
      },
      citizen: {
        name: 'Мирный житель',
        description: 'Спит ночью, голосует днём. Побеждает, если изгнать всех мафий.',
        team: 'Мирные',
        icon: '👨‍🌾',
      },
      sheriff: {
        name: 'Шериф',
        description: 'Каждую ночь проверяет одного игрока. Узнаёт, мафия он или нет (Дон маскируется).',
        team: 'Мирные',
        icon: '👮',
      },
      doctor: {
        name: 'Доктор',
        description: 'Каждую ночь выбирает игрока для лечения. Спасает от смерти и отравления.',
        team: 'Мирные',
        icon: '👨‍⚕️',
      },
      putana: {
        name: 'Путана',
        description: 'Блокирует способности игрока на ночь. Цель не может голосовать следующим днём.',
        team: 'Мирные',
        icon: '💋',
      },
      mafia: {
        name: 'Мафия',
        description: 'Ночью убивает вместе с командой. Видит других мафий. Побеждает, когда мафий ≥ мирных.',
        team: 'Мафия',
        icon: '🔪',
      },
      don: {
        name: 'Дон мафии',
        description: 'Глава мафии. Проверяет игроков на Шерифа. Для Шерифа выглядит как мирный.',
        team: 'Мафия',
        icon: '🎩',
      },
      poisoner: {
        name: 'Отравитель',
        description: 'Отравляет игрока. Тот умрёт в конце следующей ночи, если не вылечен.',
        team: 'Мафия',
        icon: '☠️',
      },
      maniac: {
        name: 'Маньяк',
        description: 'Убивает каждую ночь. Побеждает, когда остаётся один. Не видит мафию.',
        team: 'Нейтрал',
        icon: '🪓',
      },
    };
    return descriptions[role] ?? descriptions.civilian;
  }
}
