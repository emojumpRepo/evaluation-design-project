import fetch from 'node-fetch';

export const httpPost = async ({ url, headers = {}, body }) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, */*',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};
