RedmineApp::Application.routes.draw do
  resources :projects do
    resources :gantt_editor, only: [:index] do
      collection do
        post :update_dates
      end
    end
  end
end 