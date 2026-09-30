import { MIN_PASSWORD_LENGTH, passwordMeetsRules, passwordRules } from './passwordRules';

const byKey = (password: string) =>
  Object.fromEntries(passwordRules(password).map((rule) => [rule.key, rule]));

describe('passwordRules', () => {
  test('an empty password meets nothing and counts the whole length', () => {
    const rules = byKey('');
    expect(rules.length?.met).toBe(false);
    expect(rules.length?.shortfallLabel).toBe('8+ characters — 8 more to go');
    expect(rules.letter?.met).toBe(false);
    expect(rules.number?.met).toBe(false);
  });

  test("the board's own weak password: bike12 is two short, letter and number met", () => {
    const rules = byKey('bike12');
    expect(rules.length?.met).toBe(false);
    expect(rules.length?.shortfallLabel).toBe('8+ characters — 2 more to go');
    expect(rules.letter?.met).toBe(true);
    expect(rules.number?.met).toBe(true);
  });

  test('one character short reads in the singular shape the board uses', () => {
    expect(byKey('bike123').length?.shortfallLabel).toBe('8+ characters — 1 more to go');
  });

  test('a met rule carries no shortfall label', () => {
    const rules = byKey('bike12345');
    expect(rules.length?.met).toBe(true);
    expect(rules.length?.shortfallLabel).toBeNull();
  });

  test('a letter is any letter, not only ASCII', () => {
    expect(byKey('১২৩৪৫৬৭৮').letter?.met).toBe(false);
    expect(byKey('মোটরসাইকেল').letter?.met).toBe(true);
  });

  test('a digit is any decimal digit', () => {
    expect(byKey('bike১২৩৪৫').number?.met).toBe(true);
    expect(byKey('bikebike').number?.met).toBe(false);
  });

  test('symbols and spaces still count towards the length', () => {
    expect(byKey('a b-c d!').length?.met).toBe(true);
  });

  test('the rules keep the board order', () => {
    expect(passwordRules('x').map((rule) => rule.key)).toEqual(['length', 'letter', 'number']);
  });

  test('passwordMeetsRules agrees with the three chips', () => {
    expect(passwordMeetsRules('bike1234')).toBe(true);
    expect(passwordMeetsRules('bikebike')).toBe(false);
    expect(passwordMeetsRules('12345678')).toBe(false);
    expect(passwordMeetsRules('bike12')).toBe(false);
  });

  test('the floor is the one the schema enforces', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(passwordMeetsRules('a1'.padEnd(MIN_PASSWORD_LENGTH - 1, 'x'))).toBe(false);
    expect(passwordMeetsRules('a1'.padEnd(MIN_PASSWORD_LENGTH, 'x'))).toBe(true);
  });
});
