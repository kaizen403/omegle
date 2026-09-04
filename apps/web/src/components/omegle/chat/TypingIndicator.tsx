'use client';

export const TypingIndicator = () => {
  return (
    <div className="flex h-4 items-center gap-1" aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bg-text-3 animate-typing size-1.5 rounded-full"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
};
