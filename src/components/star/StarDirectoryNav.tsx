import { NavLink } from 'react-router-dom'
import { StarIcon, UsersIcon } from '../icons'

const items = [
    { path: '/star', label: '스타', icon: StarIcon },
    { path: '/stargroup', label: '스타그룹', icon: UsersIcon },
]

const StarDirectoryNav = () => (
    <section className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">스타 둘러보기</h1>
            <p className="mt-1 text-sm text-sub">스타와 스타그룹을 빠르게 전환해 찾아보세요.</p>
        </div>

        <nav
            aria-label="스타 유형"
            className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-line bg-panel p-1 shadow-sm sm:w-auto sm:min-w-80"
        >
            {items.map((item) => {
                const Icon = item.icon

                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end
                        className={({ isActive }) =>
                            `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[0.98] ${
                                isActive
                                    ? 'bg-brand text-on-brand shadow-sm'
                                    : 'text-sub hover:bg-surface hover:text-ink'
                            }`
                        }
                    >
                        <Icon size={18} />
                        <span>{item.label}</span>
                    </NavLink>
                )
            })}
        </nav>
    </section>
)

export default StarDirectoryNav
