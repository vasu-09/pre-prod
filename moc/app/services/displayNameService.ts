import apiClient from './apiClient';

type DisplayNameResponse = {
  displayName?: string | null;
};

export const fetchDisplayName = async (): Promise<string> => {
  const { data } = await apiClient.get<DisplayNameResponse>('/user/me/display-name');
  const name = typeof data?.displayName === 'string' ? data.displayName.trim() : '';
  return name;
};

export const updateDisplayName = async (displayName: string) => {
  const trimmedName = displayName.trim();
  return apiClient.put('/user/me/display-name', { displayName: trimmedName });
};

export default {
  fetchDisplayName,
  updateDisplayName,
};