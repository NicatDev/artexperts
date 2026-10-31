// Keep unrelated public sections usable when one endpoint fails.
export async function loadPublicData<T>(label: string, load: () => Promise<T>) {
  try {
    return { data: await load(), failed: false };
  } catch (error) {
    console.warn(`[public-data] ${label}`, error instanceof Error ? error.message : 'Request failed');
    return { data: null, failed: true };
  }
}
