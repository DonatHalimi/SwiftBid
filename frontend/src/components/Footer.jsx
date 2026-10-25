import { Clock, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    FacebookIconMonochrome,
    GithubIcon,
    InstagramIcon,
    LinkedInIcon,
} from '../components/Icons';
import logoIcon from '../icon.png';

const LAUNCH_YEAR = 2026;

export default function Footer() {
    const currentYear = new Date().getFullYear();
    const yearLabel = currentYear === LAUNCH_YEAR
        ? `${LAUNCH_YEAR}`
        : `${LAUNCH_YEAR} - ${currentYear}`;

    const footerLinks = {
        social: [
            {
                href: 'https://facebook.com',
                icon: <FacebookIconMonochrome className="h-5 w-5 fill-current" />,
                label: 'Facebook',
            },
            {
                href: 'https://instagram.com',
                icon: <InstagramIcon className="h-5 w-5 fill-current" />,
                label: 'Instagram',
            },
            {
                href: 'https://www.linkedin.com/in/donat-halimi-0719b0193/',
                icon: <LinkedInIcon className="h-5 w-5 fill-current" />,
                label: 'LinkedIn',
            },
            {
                href: 'https://github.com/DonatHalimi',
                icon: <GithubIcon className="h-5 w-5 fill-current" />,
                label: 'GitHub',
            },
        ],

        market: [
            { to: '/', label: 'Browse auctions' },
            { to: '/sell', label: 'Sell an item' },
            { to: '/dashboard', label: 'My dashboard' },
            { to: '/register', label: 'Create account' },
        ],

        support: [
            { to: '/contact', label: 'Contact us' },
            { to: '/faq', label: 'FAQs' },
            { to: '/privacy', label: 'Privacy policy' },
            { to: '/terms', label: 'Terms of service' },
        ],

        contact: [
            {
                linkType: 'external',
                href: 'mailto:support@swiftbid.app',
                icon: <Mail className="h-5 w-5 shrink-0" />,
                label: 'support@swiftbid.app',
            },
            {
                linkType: 'internal',
                to: '/contact',
                icon: <MapPin className="h-5 w-5 shrink-0" />,
                label: 'Ferizaj, Kosovo',
            },
            {
                linkType: 'internal',
                to: '/trust',
                icon: <ShieldCheck className="h-5 w-5 shrink-0" />,
                label: 'Trust & safety',
            },
        ],
    };

    return (
        <footer className="mt-24 border-t border-line bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-12">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
                    {/* Brand + social */}
                    <div>
                        <Link to="/" className="flex items-center gap-2.5">
                            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                                <img src={logoIcon} alt="" className="h-6 w-6 object-contain" />
                            </span>
                            <span className="text-lg font-semibold tracking-tight text-text">
                                SwiftBid
                            </span>
                        </Link>

                        <p className="mb-4 mt-4 text-sm leading-6 text-muted">
                            Bid live, make instant offers, and close deals with confidence.
                            A real-time marketplace built for fair, transparent trading.
                        </p>

                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand-500">
                            Stay connected
                        </p>

                        <div className="flex gap-4">
                            {footerLinks.social.map(({ href, icon, label }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    className="text-muted transition-colors hover:text-brand-500"
                                >
                                    {icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Marketplace */}
                    <div>
                        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand-500">
                            Marketplace
                        </h3>
                        <ul className="space-y-2.5">
                            {footerLinks.market.map(({ to, label }) => (
                                <li key={label}>
                                    <Link
                                        to={to}
                                        className="text-sm text-muted transition-colors hover:text-brand-500"
                                    >
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand-500">
                            Support
                        </h3>
                        <ul className="space-y-2.5">
                            {footerLinks.support.map(({ to, label }) => (
                                <li key={label}>
                                    <Link
                                        to={to}
                                        className="text-sm text-muted transition-colors hover:text-brand-500"
                                    >
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand-500">
                            Get in touch
                        </h3>
                        <p className="mb-4 text-sm text-muted">
                            Questions about a bid or an order? We&apos;re happy to help.
                        </p>

                        <ul className="space-y-3">
                            {footerLinks.contact.map(({ linkType, href, to, icon, label }) => {
                                const cls =
                                    'flex items-center gap-2.5 text-sm text-muted transition-colors hover:text-brand-500';
                                return (
                                    <li key={label}>
                                        {linkType === 'external' ? (
                                            <a href={href} className={cls}>
                                                {icon}
                                                <span>{label}</span>
                                            </a>
                                        ) : (
                                            <Link to={to} className={cls}>
                                                {icon}
                                                <span>{label}</span>
                                            </Link>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row">
                    <span>&copy; {yearLabel} SwiftBid. All rights reserved.</span>
                    <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Support · Mon – Sat · 9:00 – 20:00
                    </span>
                    <span>
                        Crafted by{' '}
                        <a
                            href="https://github.com/DonatHalimi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text underline decoration-line underline-offset-2 transition-colors hover:text-brand-500"
                        >
                            Donat Halimi
                        </a>
                    </span>
                </div>
            </div>
        </footer>
    );
}