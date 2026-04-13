interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const sizeClasses = {
  sm: { text: 'text-xl', tagline: 'text-[8px]', bar: 'h-6' },
  md: { text: 'text-3xl', tagline: 'text-[10px]', bar: 'h-8' },
  lg: { text: 'text-5xl', tagline: 'text-xs', bar: 'h-12' },
};

const Logo = ({ size = 'md', showTagline = true }: LogoProps) => {
  const s = sizeClasses[size];
  return (
    <div className="flex items-center gap-3">
      <div className={`w-1 ${s.bar} bg-sage rounded-full`} />
      <div>
        <div className={`${s.text} font-bold tracking-tight leading-none`}>
          <span className="text-cream">Aina</span>
          <span className="text-gold">Hoiva</span>
        </div>
        {showTagline && (
          <p className={`${s.tagline} tracking-[0.2em] uppercase text-muted-custom mt-0.5`}>
            Aina läsnä. Aina huolehtii.
          </p>
        )}
      </div>
    </div>
  );
};

export default Logo;
