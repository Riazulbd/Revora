import {
  MILEAGE_CHOICES,
  mileageChoiceLabel,
  mileageChoiceOf,
  mileageUnitForChoice,
} from './unitChoices';

describe('mileage choices', () => {
  it('draws the three segments the board draws, in board order', () => {
    expect(MILEAGE_CHOICES).toEqual(['km_per_l', 'l_per_100km', 'mpg']);
    expect(MILEAGE_CHOICES.map(mileageChoiceLabel)).toEqual(['km/L', 'L/100km', 'mpg']);
  });

  it('lights the mpg segment for either gallon', () => {
    expect(mileageChoiceOf('mpg_us')).toBe('mpg');
    expect(mileageChoiceOf('mpg_uk')).toBe('mpg');
    expect(mileageChoiceOf('km_per_l')).toBe('km_per_l');
    expect(mileageChoiceOf('l_per_100km')).toBe('l_per_100km');
  });

  it('expands mpg into the gallon the rider already fills in', () => {
    expect(mileageUnitForChoice('mpg', 'gal_uk')).toBe('mpg_uk');
    expect(mileageUnitForChoice('mpg', 'gal_us')).toBe('mpg_us');
    expect(mileageUnitForChoice('mpg', 'L')).toBe('mpg_us');
  });

  it('leaves the metric segments alone whatever the volume unit', () => {
    expect(mileageUnitForChoice('km_per_l', 'gal_uk')).toBe('km_per_l');
    expect(mileageUnitForChoice('l_per_100km', 'gal_us')).toBe('l_per_100km');
  });

  it('round-trips every unit through its segment', () => {
    expect(mileageUnitForChoice(mileageChoiceOf('mpg_uk'), 'gal_uk')).toBe('mpg_uk');
    expect(mileageUnitForChoice(mileageChoiceOf('mpg_us'), 'gal_us')).toBe('mpg_us');
    expect(mileageUnitForChoice(mileageChoiceOf('km_per_l'), 'L')).toBe('km_per_l');
  });
});
