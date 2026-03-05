export default function ModerationAlert({ warnings }) {
  if (warnings.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className={`p-4 rounded-xl shadow-2xl border backdrop-blur-sm shake ${
            warning.severity === 'high' 
              ? 'bg-red-900/90 border-red-500' 
              : 'bg-yellow-900/90 border-yellow-500'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              warning.severity === 'high' ? 'bg-red-500' : 'bg-yellow-500'
            }`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${
                warning.severity === 'high' ? 'text-red-200' : 'text-yellow-200'
              }`}>
                {warning.severity === 'high' ? 'Content Violation' : 'Warning'}
              </h3>
              <p className="text-sm text-gray-300 mt-1">
                {warning.userName}: {warning.reason}
              </p>
              {warning.strike && (
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    warning.strike >= 3 
                      ? 'bg-red-500 text-white' 
                      : 'bg-slate-700 text-gray-300'
                  }`}>
                    Strike {warning.strike}/3
                  </span>
                  {warning.strike >= 3 && (
                    <span className="text-xs text-red-300">User will be removed</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
