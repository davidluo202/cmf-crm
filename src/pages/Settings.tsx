export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings / 设置</h1>

      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Display Name</label>
          <input
            type="text"
            defaultValue="RM User"
            className="w-full max-w-md px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Email Notifications</label>
          <select className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
            <option>Enabled</option>
            <option>Disabled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Language / 语言</label>
          <select className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
            <option>English + 中文</option>
            <option>English</option>
            <option>中文</option>
          </select>
        </div>

        <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          Save Changes / 保存
        </button>
      </div>

      <div className="text-xs text-gray-600">
        CMF CRM v260624.001 &middot; Canton Mutual Financial Limited
      </div>
    </div>
  )
}
