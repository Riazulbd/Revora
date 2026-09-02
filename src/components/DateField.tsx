import React, { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import type { IsoDate } from '@/types';
import { dateToIso, formatLongDate, isoToDate } from '@/utils/date';
import { PickerField } from './Input';

/**
 * A calendar-date field.
 *
 * The value is a `'YYYY-MM-DD'` string throughout; the platform picker is only
 * ever handed a *local* `Date` built from that string, and its result is read
 * back with local getters. No UTC conversion happens anywhere, so a date picked
 * at 11pm cannot be stored as the previous day (requirement 64).
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Choose a date',
  maximumDate,
  minimumDate,
  size = 'standard',
  accessibilityLabel,
  testID,
}: {
  value: IsoDate | null;
  onChange: (next: IsoDate) => void;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  size?: 'standard' | 'compact';
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

  return (
    <>
      <PickerField
        value={value ? formatLongDate(value) : null}
        placeholder={placeholder}
        onPress={() => setOpen(true)}
        size={size}
        {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
        {...(testID === undefined ? {} : { testID })}
      />
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
