import { Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
export default function NotFoundPage() { return <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center"><p className="text-sm font-bold uppercase tracking-widest text-brand-600">404 · Not found</p><h1 className="mt-3 text-4xl font-black">That page does not exist.</h1><p className="mt-3 text-slate-500">The address may be incorrect, or the page may have been removed.</p><Link className="mt-6" to="/"><Button>Return to marketplace</Button></Link></div>; }
