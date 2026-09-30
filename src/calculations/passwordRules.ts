/**
 * What the Create account board draws under the password field.
 *
 * The board puts the rules up front — three chips that react as the rider
 * types, rather than a message that only appears once the form has been
 * rejected. Each chip is one rule, and after a refused submit the unmet
 * length rule says how far off it is ("8+ characters — 2 more to go") instead
 * of repeating the requirement the rider can already see.
 *
 * The counting lives here rather than in the screen so the rule and the
 * sentence that describes it can never disagree.
 */

/** The floor `passwordSchema` enforces; the chip and the schema share it. */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordRuleKey = 'length' | 'letter' | 'number';

export type PasswordRule = {
  key: PasswordRuleKey;
  /** The chip's own words, exactly as the board prints them. */
  label: string;
  met: boolean;
  /**
   * The label a refused submit shows instead — "8+ characters — 2 more to go".
   * Null when the rule is met, or when counting adds nothing ("A letter" is
   * either there or it is not).
   */
  shortfallLabel: string | null;
};

/** Every rule, in the board's order, for a password as typed. */
export function passwordRules(password: string): PasswordRule[] {
  const missing = Math.max(0, MIN_PASSWORD_LENGTH - password.length);

  return [
    {
      key: 'length',
      label: `${MIN_PASSWORD_LENGTH}+ characters`,
      met: missing === 0,
      shortfallLabel:
        missing === 0
          ? null
          : `${MIN_PASSWORD_LENGTH}+ characters — ${missing} more to go`,
    },
    {
      key: 'letter',
      label: 'A letter',
      met: /\p{L}/u.test(password),
      shortfallLabel: null,
    },
    {
      key: 'number',
      label: 'A number',
      met: /\p{Nd}/u.test(password),
      shortfallLabel: null,
    },
  ];
}

/** True when every rule on the board is satisfied. */
export function passwordMeetsRules(password: string): boolean {
  return passwordRules(password).every((rule) => rule.met);
}
