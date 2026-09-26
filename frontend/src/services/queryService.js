import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const API = axios.create({
  baseURL: API_URL,
});

const authenticatedRequest = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
});

export const executeQuery = async (query, database = "mysql") => {
  const response = await API.post("/query", {
    query,
    database,
  }, authenticatedRequest());

  return response.data;
};

export const analyzeQuery = async (query, database = "mysql") => {
  const response = await API.post("/analyze", {
    query,
    database,
  }, authenticatedRequest());

  return response.data;
};

export const getExecutionPlan = async (query, database = "mysql") => {
  const response = await API.post("/execution-plan", {
    query,
    database,
  }, authenticatedRequest());

  return response.data;
};
