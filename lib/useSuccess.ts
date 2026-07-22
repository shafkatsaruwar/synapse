import { useState, useCallback } from "react";

interface UseSuccessOptions {
  duration?: number;
}

export function useSuccess(options?: UseSuccessOptions) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  const showSuccess = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  return {
    message,
    visible,
    showSuccess,
    dismiss,
    duration: options?.duration || 3000,
  };
}
