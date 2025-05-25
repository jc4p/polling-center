'use client';

export function RadioOption({ value, checked, onChange, children, name }) {
  return (
    <label className="flex items-center gap-4 rounded-xl border border-solid border-mint-200 p-[15px] cursor-pointer">
      <input
        type="radio"
        className="h-5 w-5 border-2 border-mint-200 bg-transparent text-transparent checked:border-forest-700 checked:bg-[image:--radio-dot-svg] focus:outline-none focus:ring-0 focus:ring-offset-0 checked:focus:border-forest-700"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        style={{
          '--radio-dot-svg': 'url(\'data:image/svg+xml,%3csvg viewBox=%270 0 16 16%27 fill=%27rgb(74,183,20)%27 xmlns=%27http://www.w3.org/2000/svg%27%3e%3ccircle cx=%278%27 cy=%278%27 r=%273%27/%3e%3c/svg%3e\')'
        }}
      />
      <div className="flex grow flex-col">
        <p className="text-forest-900 text-sm font-medium leading-normal">{children}</p>
      </div>
    </label>
  );
}

export function RadioGroup({ children, name, value, onChange }) {
  return (
    <div className="flex flex-col gap-3">
      {children}
    </div>
  );
}