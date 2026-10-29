import API from './api';

export const executeQuery = async (query, database = "sqlite") => {
  const response = await API.post("/query", {
    query,
    database,
  });

  return response.data;
};

export const analyzeQuery = async (query, database = "sqlite") => {
  const response = await API.post("/analyze", {
    query,
    database,
  });

  return response.data;
};
