import React, { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import type { IsoDate } from '@/types';
import { dateToIso, formatLongDate, isoToDate, todayIso } from '@/utils/date';
import type { IconName } from './Icon';
import { PickerField, type InputSize } from './Input';
import { PickerRow } from './InputRow';

/**
 * A calendar-date field.
 *
 * The value is a `'YYYY-MM-DD'` string throughout; the platform picker is only
 * ever handed a *local* `Date` built from that string, and its result is read
 * back with local getters. No UTC conversion happens anywhere, so a date picked
 * at 11pm cannot be stored as the previous day (requirement 64).
 *
 * Today prints as "Today" (or "Today, 16 Sep" with `todayLabel="Today, "`
 * and a format); pass `format` to change the printed form.
 *
 * `variant="row"` draws it as a `PickerRow` inside a fields card (Figma's
 * `Date` row) instead of a standalone field.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Pick a date',
  maximumDate,
  minimumDate,
  size = 'standard',
  weight = 'bold',
  inset,
  padX,
  trailingIcon,
  todayLabel = 'Today',
  format = formatLongDate,
  variant = 'field',
  icon,
  label = 'Date',
  accessibilityLabel,
  testID,
}: {
  value: IsoDate | null;
  onChange: (next: IsoDate) => void;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  size?: InputSize;
  weight?: 'regular' | 'bold';
  inset?: boolean | 'bg' | 'sur' | 'sur2';
  /** Matches `Input`'s `padX` — 14 inside a card, 16 on the page. */
  padX?: number;
  /** The chevron on "Pick a date"; omitted once a date is chosen unless `alwaysShowIcon`. */
  trailingIcon?: IconName;
  /** What today prints as; `null` prints the formatted date instead. */
  todayLabel?: string | null;
  format?: (iso: IsoDate) => string;
  variant?: 'field' | 'row';
  /** The row variant's glyph. */
  icon?: IconName;
  /** The row variant's label. */
  label?: string;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(dateToIso(selected));
    if (Platform.OS === 'ios') setOpen(false);
  };

  const printed =
    value === null
      ? null
      : todayLabel !== null && value === todayIso()
        ? todayLabel.endsWith(' ')
          ? `${todayLabel}${format(value)}`
          : todayLabel
        : format(value);

  return (
    <>
      {variant === 'row' ? (
        <PickerRow
          {...(icon === undefined ? {} : { icon })}
          label={label}
          value={printed}
          placeholder={placeholder}
          onPress={() => setOpen(true)}
          {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
          {...(testID === undefined ? {} : { testID })}
        />
      ) : (
      <PickerField
        value={printed}
        placeholder={placeholder}
        onPress={() => setOpen(true)}
        size={size}
        weight={weight}
        {...(inset === undefined ? {} : { inset })}
        {...(padX === undefined ? {} : { padX })}
        {...(trailingIcon === undefined ? {} : { trailingIcon })}
        {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
        {...(testID === undefined ? {} : { testID })}
      />
      )}
      {open ? (
        <DateTimePicker
          value={value ? isoToDate(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
          {...(maximumDate ? { maximumDate } : {})}
          {...(minimumDate ? { minimumDate } : {})}
        />
      ) : null}
    </>
  );
}
