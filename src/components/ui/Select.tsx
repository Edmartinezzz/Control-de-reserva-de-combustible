import React from 'react';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select(props: SelectProps) {
  return <select {...props} className={`mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${props.className ?? ''}`}>{props.children}</select>;
}





