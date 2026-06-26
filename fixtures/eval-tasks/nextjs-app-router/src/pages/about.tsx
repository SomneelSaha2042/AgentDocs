import React from 'react';

export async function getServerSideProps() {
  const data = await fetch('https://api.example.com/about').then(res => res.json());
  return { props: { data } };
}

export default function AboutPage({ data }) {
  return (
    <div>
      <h1>About</h1>
      <p>{data.description}</p>
    </div>
  );
}
