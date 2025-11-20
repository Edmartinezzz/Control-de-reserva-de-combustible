import React from 'react';

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="min-w-full text-sm">{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gray-50 text-left">{children}</thead>;
}

export function TRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-t">{children}</tr>;
}

export function TH({ children }: { children: React.ReactNode }) {
  return <th className="p-3 font-medium text-gray-700">{children}</th>;
}

export function TD({ children }: { children: React.ReactNode }) {
  return <td className="p-3 align-top">{children}</td>;
}






