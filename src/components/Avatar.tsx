type AvatarProps = {
  name: string;
  accent: string;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "size-9 text-sm",
  md: "size-14 text-xl",
  lg: "size-20 text-3xl",
};

/** Avatar provisional con la inicial del personaje (sin imágenes por ahora). */
export function Avatar({ name, accent, size = "md" }: AvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-semibold text-white ${accent} ${SIZES[size]}`}
    >
      {name.charAt(0)}
    </div>
  );
}
