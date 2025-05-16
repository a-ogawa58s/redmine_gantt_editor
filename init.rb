require 'redmine'

Redmine::Plugin.register :redmine_gantt_editor do
  name 'Redmine Gantt Editor'
  author 'Your Name'
  description 'ガントチャートから直接日付を編集できるプラグイン'
  version '1.0.0'
  url 'https://github.com/yourusername/redmine_gantt_editor'
  author_url 'https://github.com/yourusername'

  project_module :gantt_editor do
    permission :view_gantt_editor, { :gantt_editor => :index }, :caption => :label_view_gantt_editor
    permission :edit_gantt_editor, { :gantt_editor => :update_dates }, :caption => :label_edit_gantt_editor
  end

  menu :project_menu, :gantt_editor, { :controller => 'gantt_editor', :action => 'index' },
          :caption => :label_gantt_editor, 
          :after => :gantt, 
          :param => :project_id
end
