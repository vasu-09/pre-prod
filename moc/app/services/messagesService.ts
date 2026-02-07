import { sendDeleteForEveryone, sendDeleteForMe } from '../constants/stompEndpoints';
import apiClient from './apiClient';
import stompClient from './stompClient';

export const fetchMessageHistory = async (roomKey: string) => {
  const { data } = await apiClient.get(`/api/messages/${roomKey}/history`);
  return Array.isArray(data) ? data : [];
};

export const deleteMessageForMe = async (messageId: string | number) => {
  await stompClient.publish(sendDeleteForMe(messageId), {});
};

export const deleteMessageForEveryone = async (messageId: string | number) => {
  await stompClient.publish(sendDeleteForEveryone(messageId), {});
};

export const fetchPendingMessages = async (since?: string) => {
  const params = since ? { params: { since } } : undefined;
  const { data } = await apiClient.get('/api/messages/pending', params);
  return Array.isArray(data) ? data : [];
};