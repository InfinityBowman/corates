export default function AuthLayout(props) {
  return (
    <div class='min-h-screen bg-blue-50 flex items-center justify-center px-4 py-8 sm:py-12'>
      <div class='w-full max-w-md sm:max-w-xl'>{props.children}</div>
    </div>
  );
}
