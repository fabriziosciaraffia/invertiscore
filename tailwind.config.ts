import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			heading: ['var(--font-heading)', 'Georgia', 'serif'],
  			body: ['var(--font-body)', '-apple-system', 'sans-serif'],
  			mono: ['var(--font-mono)', 'monospace'],
  		},
  		colors: {
  			franco: {
  				ink: '#0F0F0F',
  				red: '#C8323C',
  				muted: '#71717A',
  				bg: '#FAFAF8',
  				'bg-dark': '#F0F0EC',
  				border: '#E6E6E2',
  				positive: '#B0BEC5',
  				warning: '#FBBF24',
  				negative: '#C8323C',
  				neutral: '#71717A',
  			},
  			verdict: {
  				buy: '#B0BEC5',
  				negotiate: '#C8323C',
  				avoid: '#C8323C',
  			},
  			th: {
  				page: 'var(--franco-bg-page)',
  				card: 'var(--franco-bg-card)',
  				surface: 'var(--franco-bg-surface)',
  				elevated: 'var(--franco-bg-elevated)',
  				text: 'var(--franco-text-primary)',
  				'text-secondary': 'var(--franco-text-secondary)',
  				'text-muted': 'var(--franco-text-muted)',
  				border: 'var(--franco-border)',
  				'border-strong': 'var(--franco-border-strong)',
  				'border-hover': 'var(--franco-border-hover)',
  				'bar-fill': 'var(--franco-bar-fill)',
  				'bar-track': 'var(--franco-bar-track)',
  				'signal-red': 'var(--franco-signal-red)',
  				negative: 'var(--franco-negative)',
  				'input-bg': 'var(--franco-input-bg)',
  				nav: 'var(--franco-nav-bg)',
  				'nav-hover': 'var(--franco-nav-hover)',
  				'btn-primary': 'var(--franco-btn-primary-bg)',
  				'btn-primary-text': 'var(--franco-btn-primary-text)',
  				'btn-primary-hover': 'var(--franco-btn-primary-hover)',
  				positive: 'var(--franco-positive)',
  				'verdict-buy': 'var(--franco-verdict-buy-text)',
  				'verdict-buy-bg': 'var(--franco-verdict-buy-bg)',
  				'verdict-adjust': 'var(--franco-verdict-adjust-text)',
  				'verdict-adjust-bg': 'var(--franco-verdict-adjust-bg)',
  				'verdict-avoid': 'var(--franco-verdict-avoid-text)',
  				'verdict-avoid-bg': 'var(--franco-verdict-avoid-bg)',
  				'scenario-good-bg': 'var(--franco-scenario-good-bg)',
  				'scenario-good-border': 'var(--franco-scenario-good-border)',
  				'scenario-bad-bg': 'var(--franco-scenario-bad-bg)',
  				'scenario-bad-border': 'var(--franco-scenario-bad-border)',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': { opacity: '0', transform: 'translateY(6px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' },
  			},
  		},
  		animation: {
  			fadeIn: 'fadeIn 0.4s ease-out forwards',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
