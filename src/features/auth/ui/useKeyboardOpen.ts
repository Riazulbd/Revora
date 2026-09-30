import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * True while the soft keyboard is up.
 *
 * The Sign in board draws a keyboard-open frame of its own: the reassurance
 * sentence steps aside and the fields tighten, so the two inputs and the button
 * all stay above the keyboard on a 5.5" phone. That is a layout the screen has
 * to know about, not something `KeyboardAvoidingView` can do by scrolling.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return open;
}
