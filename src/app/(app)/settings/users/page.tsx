import { SignInSettings, UserSettings } from '@app/components/Settings/Pages';

export default function Page() {
  return (
    <>
      <UserSettings />
      <div className="mt-10">
        <SignInSettings />
      </div>
    </>
  );
}
