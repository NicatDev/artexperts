export function FeedError({ locale }: { locale: string }) {
  return (
    <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
      {locale === 'az' ? 'Məlumatları hazırda yükləmək mümkün olmadı. Bir az sonra səhifəni yeniləyin.'
        : locale === 'ru' ? 'Не удалось загрузить данные. Обновите страницу немного позже.'
        : 'Could not load this content right now. Please refresh the page in a moment.'}
    </p>
  );
}
