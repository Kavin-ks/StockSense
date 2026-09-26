import { useState } from 'react';
import { ApiError } from '../api/client.js';

/**
 * Small form helper: values, client-side validation, server field errors, submit state.
 * `validate(values)` returns { field: message } for client-side checks.
 */
export function useForm(initial, { validate, onSubmit }) {
  const [values, setValuesState] = useState(initial);
  // dirty = the user typed something since the values were last loaded/reset.
  // Live updates only overwrite a form that is not dirty.
  const [dirty, setDirty] = useState(false);
  const setValues = (next) => { setValuesState(next); setDirty(false); };
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (name, value) => {
    setValuesState((v) => ({ ...v, [name]: value }));
    setDirty(true);
    if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
  };

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => set(name, e.target.type === 'checkbox' ? e.target.checked : e.target.value),
    error: errors[name],
  });

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setFormError('');
    const clientErrors = validate?.(values) ?? {};
    if (Object.keys(clientErrors).length) return setErrors(clientErrors);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, set, bind, errors, setErrors, formError, setFormError, submitting, dirty, handleSubmit };
}
