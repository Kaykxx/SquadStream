import { VolumeIcon } from './Icons'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
}

export default function VolumeSlider({ label, value, onChange }: Props) {
  const boosted = value > 100
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><VolumeIcon />{label}</span>
        <span className={boosted ? 'font-semibold text-amber-400' : 'text-zinc-200'}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={200} step={5} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(100)}
        className="w-full cursor-pointer"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-zinc-600"><span>0</span><span>100</span><span>200</span></div>
    </label>
  )
}
