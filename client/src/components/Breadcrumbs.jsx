import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Breadcrumb navigation trail.
 * items = [{ label, to? }]
 */
export function Breadcrumbs({ items = [] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumbs">
      <ol className="breadcrumbs-list">
        <li className="breadcrumbs-item">
          <Link to="/" className="breadcrumbs-link" title="Dashboard">
            <Home size={14} className="breadcrumbs-home-icon" />
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label + index} className="breadcrumbs-item">
              <ChevronRight size={13} className="breadcrumbs-sep" aria-hidden="true" />
              {isLast || !item.to ? (
                <span className="breadcrumbs-current" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="breadcrumbs-link">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
