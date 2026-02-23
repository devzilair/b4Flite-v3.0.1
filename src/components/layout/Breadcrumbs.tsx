import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStaff } from '../../hooks/useStaff';

const Breadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const pathnames = pathname.split('/').filter((x) => x);
  const { staff, departments } = useStaff();

  if (pathnames.length === 0) {
    return null;
  }

  const resolveName = (segment: string) => {
    // 1. Check for 'new' keyword
    if (segment === 'new') return 'New Entry';

    // 2. Try to find a staff member with this ID
    const staffMember = staff.find(s => s.id === segment);
    if (staffMember) return staffMember.name;

    // 3. Try to find a department with this ID
    const dept = departments.find(d => d.id === segment);
    if (dept) return dept.name;

    // 4. Fallback: Capitalize first letter
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return (
    <nav aria-label="breadcrumb" className="mb-6">
      <ol className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
        <li>
          <Link href="/" className="hover:underline">Home</Link>
        </li>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const name = resolveName(value);

          return (
            <li key={to} className="flex items-center">
              <span className="mx-2">/</span>
              {isLast ? (
                <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{name}</span>
              ) : (
                <Link href={to} className="hover:underline truncate max-w-[150px]">{name}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;