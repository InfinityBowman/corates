import Navbar from './Navbar.jsx';

export default function MainLayout(props) {
  return (
    <div class='min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50'>
      <Navbar />
      <main class='text-gray-900'>{props.children}</main>
    </div>
  );
}
