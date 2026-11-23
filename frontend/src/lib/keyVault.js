// Gateway keys are only returned once by the backend. To make the Playground easy to use,
// we remember freshly created keys for THIS browser tab only (sessionStorage, gone when the tab closes).
const K = 'aegis_session_keys';

const read = () => {
  try { return JSON.parse(sessionStorage.getItem(K) || '[]'); } catch { return []; }
};

export const keyVault = {
  list: () => read(),
  save: (entry) => sessionStorage.setItem(K, JSON.stringify([entry, ...read().filter((e) => e.id !== entry.id)])),
  remove: (id) => sessionStorage.setItem(K, JSON.stringify(read().filter((e) => e.id !== id))),
};
