export function PasswordRequirements({ password = '', showError = false }) {
  const isStarted = password.length > 0 || showError;

  const requirements = [
    {
      id: 'length',
      label: 'At least 9 characters',
      satisfied: password.length >= 9,
    },
    {
      id: 'uppercase',
      label: 'One uppercase letter',
      satisfied: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'One lowercase letter',
      satisfied: /[a-z]/.test(password),
    },
    {
      id: 'special',
      label: 'One special character',
      satisfied: /[^A-Za-z0-9]/.test(password),
    },
  ];

  return (
    <div className="password-requirements" aria-label="Password requirements">
      <span className="password-requirements-title">Password requirements</span>
      <ul className="password-requirements-list" role="list">
        {requirements.map((req) => {
          let statusClass = 'neutral';
          let symbol = '○';
          let statusText = 'requirement';

          if (isStarted) {
            if (req.satisfied) {
              statusClass = 'satisfied';
              symbol = '✓';
              statusText = 'satisfied';
            } else {
              statusClass = 'unsatisfied';
              symbol = '✗';
              statusText = 'not satisfied';
            }
          }

          return (
            <li
              key={req.id}
              className={`password-req-item ${statusClass}`}
              aria-label={`${req.label}: ${statusText}`}
            >
              <span className="password-req-icon" aria-hidden="true">
                {symbol}
              </span>
              <span>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
