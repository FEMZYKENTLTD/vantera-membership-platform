import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-noir disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        primary:
          'bg-gold-500 text-noir-900 hover:bg-gold-400 font-semibold tracking-wide',
        secondary:
          'border border-gold-500/40 bg-transparent text-gold-300 hover:bg-gold-500/10 hover:border-gold-500/70',
        ghost: 'text-ivory-100/70 hover:text-ivory-100 hover:bg-ivory-100/5',
        danger: 'bg-danger/90 text-ivory-100 hover:bg-danger',
        subtle: 'bg-noir-700 text-ivory-100 hover:bg-noir-600 border border-border'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-5',
        lg: 'h-12 px-8 text-[15px]'
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
