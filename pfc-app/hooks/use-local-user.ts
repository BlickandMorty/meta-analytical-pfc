'use client';

import { useEffect, useState } from 'react';
import { generateUUID } from '@/lib/utils';

const USER_ID_KEY = 'pfc-user-id';

export function useLocalUser() {
  const [userId, setUserId] = useState<string>('local-user');

  useEffect(() => {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(USER_ID_KEY, id);
    }
    setUserId(id);
  }, []);

  return userId;
}
