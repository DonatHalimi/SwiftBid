import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, ChevronDown, ListPlus, Tag, Timer } from 'lucide-react';
import { api } from '../lib/api.js';
import { productCategories } from '../lib/categories.js';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import Select from '../components/Select.jsx';
import ImageDropzone from '../components/ImageDropzone.jsx';
import { ErrorNotice } from '../components/Notice.jsx';

const productCategoryValues = productCategories.map((c) => c.value);

const schema = z
  .object({
    title: z.string().trim().min(4, 'Use at least 4 characters.').max(120),
    description: z
      .string()
      .trim()
      .min(20, 'Add at least 20 characters of detail.')
      .max(10000),
    category: z.enum(productCategoryValues),
    condition: z.enum(['NEW', 'USED', 'REFURBISHED']),
    startingPrice: z.coerce
      .number()
      .positive('Enter a positive price.')
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
        'Use no more than two decimals.'
      ),
    reservePrice: z.union([z.literal(''), z.coerce.number().positive()]).optional(),
    auctionEndsAt: z.string().min(1, 'Choose an end time.'),
    allowDirectOffers: z.boolean(),
    images: z.any().optional(),
  })
  .refine(
    (value) =>
      !value.reservePrice ||
      Number(value.reservePrice) >= Number(value.startingPrice),
    { path: ['reservePrice'], message: 'Reserve must be at least the starting price.' }
  )
  .refine(
    (value) => new Date(value.auctionEndsAt).getTime() > Date.now() + 60_000,
    { path: ['auctionEndsAt'], message: 'Choose a time at least one minute from now.' }
  );

const conditionOptions = [
  { value: 'NEW', label: 'New' },
  { value: 'USED', label: 'Used' },
  { value: 'REFURBISHED', label: 'Refurbished' },
];

function localDateTime(days = 1) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function SectionCard({
  icon: Icon,
  title,
  description,
  defaultOpen = true,
  badge,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-5 text-left transition-colors hover:bg-slate-50 sm:p-6 dark:hover:bg-slate-800/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
          <Icon size={17} />
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold">{title}</span>
            {!open && badge && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {badge}
              </span>
            )}
          </span>
          {description && (
            <span className="mt-0.5 block text-sm text-slate-500">
              {description}
            </span>
          )}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="mt-1 shrink-0 text-slate-400"
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-slate-200 px-5 pb-5 pt-5 sm:px-6 sm:pb-6 dark:border-slate-800">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function CreateListingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      category: productCategories[0].value,
      condition: 'USED',
      allowDirectOffers: true,
      auctionEndsAt: localDateTime(),
      images: [],
    },
  });

  const mutation = useMutation({
    mutationFn: (values) => {
      const body = new FormData();
      body.append('title', values.title);
      body.append('description', values.description);
      body.append('category', values.category);
      body.append('condition', values.condition);
      body.append('startingPrice', String(values.startingPrice));
      if (values.reservePrice !== '' && values.reservePrice != null) {
        body.append('reservePrice', String(values.reservePrice));
      }
      body.append('auctionEndsAt', new Date(values.auctionEndsAt).toISOString());
      body.append('allowDirectOffers', String(values.allowDirectOffers));
      for (const image of Array.from(values.images || [])) {
        body.append('images', image);
      }
      return api.post('/products', body);
    },
    onSuccess: async ({ product }) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/products/${product.id}`);
    },
    onError: setError,
  });

  async function submit(values) {
    setError(null);
    mutation.mutate(values);
  }

  const images = watch('images') ?? [];
  const imageCount = Array.from(images).length;
  const allowOffers = watch('allowDirectOffers');

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Seller tools
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          Create a listing
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Set an auction end time and decide whether buyers can purchase
          immediately with an instant offer.
        </p>
      </header>

      <ErrorNotice error={error} />

      <form className="space-y-5" onSubmit={handleSubmit(submit)}>
        <SectionCard
          icon={Tag}
          title="Item details"
          description="Help buyers find and trust your listing."
          defaultOpen
          badge={
            watch('title')?.trim()
              ? watch('title').trim().slice(0, 24) +
              (watch('title').trim().length > 24 ? '…' : '')
              : undefined
          }
        >
          <Field
            label="Listing title"
            placeholder="e.g. Vintage mechanical watch"
            {...register('title')}
            error={errors.title?.message}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="category"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Category
              </label>
              <Select
                id="category"
                value={watch('category')}
                onChange={(value) =>
                  setValue('category', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={productCategories}
              />
              {errors.category && (
                <p className="text-sm text-red-600">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="condition"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Item condition
              </label>
              <Select
                id="condition"
                value={watch('condition')}
                onChange={(value) =>
                  setValue('condition', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={conditionOptions}
              />
              {errors.condition && (
                <p className="text-sm text-red-600">{errors.condition.message}</p>
              )}
            </div>
          </div>

          <Field
            label="Description"
            {...register('description')}
            error={errors.description?.message}
          >
            <textarea
              className="field min-h-36"
              placeholder="Describe the item's condition, history, included accessories, and any defects…"
              {...register('description')}
            />
          </Field>
        </SectionCard>

        <SectionCard
          icon={Tag}
          title="Images"
          description="The first image is used as the listing cover."
          defaultOpen
          badge={
            imageCount > 0
              ? `${imageCount} image${imageCount === 1 ? '' : 's'}`
              : undefined
          }
        >
          <ImageDropzone
            value={images}
            onChange={(files) =>
              setValue('images', files, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
        </SectionCard>

        <SectionCard
          icon={Timer}
          title="Pricing & auction"
          description="Prices are in EUR. Reserve prices stay hidden from buyers."
          defaultOpen
          badge={
            watch('startingPrice')
              ? `€${watch('startingPrice')}`
              : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Starting price"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="25.00"
              {...register('startingPrice')}
              error={errors.startingPrice?.message}
            />
            <Field
              label="Hidden reserve"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Optional"
              {...register('reservePrice')}
              error={errors.reservePrice?.message}
              hint="Only you can see this."
            />
          </div>

          <Field
            label="Auction end"
            type="datetime-local"
            {...register('auctionEndsAt')}
            error={errors.auctionEndsAt?.message}
          >
            <div className="relative">
              <input
                type="datetime-local"
                className="field pr-10"
                {...register('auctionEndsAt')}
              />
              <CalendarClock
                size={17}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </Field>
        </SectionCard>

        <SectionCard
          icon={ListPlus}
          title="Purchase options"
          description="Decide how buyers can close the deal."
          defaultOpen
          badge={allowOffers ? 'Instant offers on' : 'Instant offers off'}
        >
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-brand-600/5">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-brand-600"
              {...register('allowDirectOffers')}
            />
            <span>
              <span className="block font-semibold">Allow instant offers</span>
              <span className="mt-1 block text-sm text-slate-500">
                A confirmed offer immediately marks the listing sold, accepts
                the offer, and creates an order. Seller approval is not part of
                this MVP flow.
              </span>
            </span>
          </label>
        </SectionCard>

        <div className="sticky bottom-0 flex justify-end gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            <ListPlus size={17} />
            {mutation.isPending ? 'Publishing…' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </div>
  );
}