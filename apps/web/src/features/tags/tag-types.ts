export type TagFormState = {
  status: 'idle' | 'error' | 'success';
  error?: string;
  values?: { name?: string; color?: string };
};

export const initialTagFormState: TagFormState = {
  status: 'idle',
};
