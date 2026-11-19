import { useStore } from '@just-apps/app-kit'
import { profileId } from '@just-apps/claude-code'
import { cn } from '@justanarthur/modo-ui/lib/utils'
import SizeProvider from '@justanarthur/modo-ui/primitives/systems/sizes'
import { type Business, BusinessForm, type BusinessFormProps, type Worker, WorkerForm } from '@justanarthur/modo-ui-standards'
import { useState } from 'react'
import { newBusiness, newWorker, parseRefusal, type Refusal, workerGaps } from './config'
import type { Model } from './model'
import type { Config } from './use-config'
import { useProfiles } from './use-config'
import { messageOf } from './use-standards'

/** The store key of the profile picked in onboarding: new workers start on it. */
export const PROFILE_KEY = 'onboarding.profile'

const NONE: Refusal = { fields: {} }

/** A refusal the form has no field for, over it. */
export function Refused({ message, className }: { message?: string; className?: string }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className={cn(
        'mx-5 mt-4 shrink-0 whitespace-pre-wrap break-words rounded-box bg-destructive-wash px-3 py-2 font-mono text-caption text-destructive-strong',
        className,
      )}
    >
      {message}
    </p>
  )
}

/** The business form's state and its writes: Save, Delete and Clone, each refused one with its messages. */
export function useBusinessForm(config: Config, original: Business | undefined, onSaved: (business: Business) => void) {
  const [draft, setDraft] = useState<Business>(original ?? newBusiness())
  const [refusal, setRefusal] = useState<Refusal>(NONE)
  const [saving, setSaving] = useState(false)
  const [cloning, setCloning] = useState<string>()
  // What is on disk, under the id it was saved with: Clone runs on the saved business.
  const [saved, setSaved] = useState(original)

  async function write(business: Business) {
    await config.saveBusiness(business, saved?.id)
    setSaved(business)
  }

  async function save(business: Business) {
    setSaving(true)
    try {
      await write(business)
      setRefusal(NONE)
      onSaved(business)
    } catch (error) {
      setRefusal(parseRefusal(messageOf(error), 'business'))
    } finally {
      setSaving(false)
    }
  }

  /** The CLI clones an asset of the business on disk, so unsaved edits are saved first. */
  async function clone(asset: string) {
    setCloning(asset)
    try {
      if (JSON.stringify(draft) !== JSON.stringify(saved)) await write(draft)
      const path = await config.clone(draft.id, asset)
      setDraft(business => ({ ...business, assets: business.assets.map(a => (a.id === asset ? { ...a, path } : a)) }))
      setSaved(business => business && { ...business, assets: business.assets.map(a => (a.id === asset ? { ...a, path } : a)) })
      setRefusal(NONE)
    } catch (error) {
      setRefusal(parseRefusal(messageOf(error), 'business'))
    } finally {
      setCloning(undefined)
    }
  }

  const props = {
    value: draft,
    onValueChange: setDraft,
    errors: refusal.fields,
    onSave: save,
    saving,
    onClone: clone,
    cloning,
  } satisfies Partial<BusinessFormProps>
  return { props, refusal, setRefusal, saved }
}

interface BusinessPaneProps {
  model: Model
  config: Config
  /** The business to edit; none adds one. */
  id?: string
  onSaved: (business: Business, was?: string) => void
  onRemoved: () => void
  onClose: () => void
}

export function BusinessPane({ model, config, id, onSaved, onRemoved, onClose }: BusinessPaneProps) {
  const original = model.businesses.find(b => b.id === id)
  const form = useBusinessForm(config, original, business => onSaved(business, original?.id))

  async function remove() {
    if (!form.saved) return
    try {
      await config.removeBusiness(form.saved.id)
      onRemoved()
    } catch (error) {
      form.setRefusal({ fields: {}, message: messageOf(error) })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col select-text">
      <Refused message={form.refusal.message} />
      <BusinessForm
        {...form.props}
        packs={model.packs}
        title={original ? `Edit ${original.name}` : 'New business'}
        onCancel={onClose}
        onDelete={form.saved ? remove : undefined}
        onClose={onClose}
        className="min-h-0 flex-1"
      />
    </div>
  )
}

interface WorkerPaneProps {
  model: Model
  config: Config
  /** The worker to edit; none adds one. */
  id?: string
  onDone: () => void
}

export function WorkerPane({ model, config, id, onDone }: WorkerPaneProps) {
  const found = useProfiles()
  const [picked] = useStore(PROFILE_KEY, '')
  const original = model.workers.find(w => w.id === id)
  const [draft, setDraft] = useState<Worker>(original ?? newWorker(picked || '~/.claude'))
  const [refusal, setRefusal] = useState<Refusal>(NONE)
  const [saving, setSaving] = useState(false)
  // A worker can name a profile this machine doesn't have: it stays pickable.
  const profiles = [...(found ?? [])]
  if (!profiles.some(p => p.configDir === draft.profile)) profiles.push({ configDir: draft.profile, label: profileId(draft.profile) })

  async function save(worker: Worker) {
    const gaps = workerGaps(worker)
    if (Object.keys(gaps.fields).length) return setRefusal(gaps)
    setSaving(true)
    try {
      await config.saveWorker(worker, original?.id)
      onDone()
    } catch (error) {
      setRefusal(parseRefusal(messageOf(error), 'worker'))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!original) return
    try {
      await config.removeWorker(original.id)
      onDone()
    } catch (error) {
      setRefusal({ fields: {}, message: messageOf(error) })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col select-text">
      <Refused message={refusal.message} />
      {/* The four permission levels fit the side pane's width only at the compact step. */}
      <SizeProvider size="compact">
        <WorkerForm
          value={draft}
          onValueChange={setDraft}
          profiles={profiles}
          errors={refusal.fields}
          title={original ? `Edit ${original.id}` : 'New worker'}
          onSave={save}
          saving={saving}
          onCancel={onDone}
          onDelete={original ? remove : undefined}
          onClose={onDone}
          className="min-h-0 flex-1"
        />
      </SizeProvider>
    </div>
  )
}
