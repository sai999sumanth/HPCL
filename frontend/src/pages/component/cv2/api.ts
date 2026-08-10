import { apiClient } from "@/services/apiClient";

const API_BASE_URL = '/api';

export const createCredential = async (data: any) => {
  try {
    const response = await apiClient.post(`${API_BASE_URL}/credsmodel/create_credential`, JSON.stringify(data));

    if (!response.status) {
      throw new Error('Network response was not ok');
    }

    return await response.data;
  } catch (error) {
    console.error('Error creating credential:', error);
    throw error;
  }
};

export const getCredential = async (id: string) => {
  try {
    const response = await apiClient.get(`${API_BASE_URL}/credentials/${id}`);
    if (!response.status) {
      throw new Error('Network response was not ok');
    }
    return await response.data;
  } catch (error) {
    console.error('Error fetching credential:', error);
    throw error;
  }
};

export const updateCredential = async (data: any) => {

  try {
    const response = await apiClient.post(`${API_BASE_URL}/credsmodel/create_credential`, JSON.stringify(data));

    if (!response.status) {
      throw new Error('Network response was not ok');
    }

    return await response.data;
  } catch (error) { 
    console.error('Error updating credential:', error);
    throw error;
  }
};

export const deleteCredential = async (id: string) => {   

  try {  
    const response = await apiClient.delete(`${API_BASE_URL}/credentials/${id}`);

    if (!response.status) {
      throw new Error('Network response was not ok');
    }

    return await response.data;
  } catch (error) {
    console.error('Error deleting credential:', error);
    throw error;
  }

};

export const getAllCredentials = async () => {  
  try { 
    const response = await apiClient.get(`${API_BASE_URL}/credsmodel`);
    if (!response.status) { 
      throw new Error('Network response was not ok');
    }
    return await response.data;
  } catch (error) {   
    console.error('Error fetching all credentials:', error);
    throw error;
  }

};

export const getLoadCreds = async () => {

    try {
      const response = await apiClient.post(`${API_BASE_URL}/credsmodel/load_creds`, {}); 
      if (!response.status) {  
        throw new Error('Network Response was not ok');
      }
      return await response.data;
    } 
    
    catch (error) {  
      console.error('Error fetching all credentials:', error);
      throw error;
    }

};
