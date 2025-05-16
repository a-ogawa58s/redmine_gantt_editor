class GanttEditorController < ApplicationController
  unloadable

  before_action :find_project
  before_action :authorize
  before_action :check_module_enabled
  #before_action :find_optional_project

  def index
    @issues = @project.issues
      #.select('issues.*, trackers.name as tracker_name, issue_statuses.name as status_name')
      #.joins(:tracker, :status)
      .includes(:status, :tracker, :priority, :assigned_to, :parent)
      .where.not(start_date: nil)
      #.where.not(due_date: nil)
      .order(:start_date)

    Rails.logger.info "Found #{@issues.count} issues"
    @issues.each do |issue|
      Rails.logger.info "Issue ##{issue.id}: #{issue.subject} (#{issue.start_date} - #{issue.due_date}) #{issue.parent_id}"
    end

    respond_to do |format|
      format.html
      format.json { 
        render json: {
          tasks: @issues.map { |issue| 
            {
              id: issue.id,
              subject: issue.subject,
              start_date: issue.start_date,
              due_date: issue.due_date,
              status_name: issue.status.name,
              tracker_name: issue.tracker.name,
              done_ratio: issue.done_ratio,
              parent_id: issue.parent_id
            }
          }
        }
      }
    end
  end

  def update_dates
    Rails.logger.info "Received params: #{params.inspect}"
    
    begin
      Issue.transaction do
        @issue = @project.issues.lock.find(params[:issue_id])
        
        if params[:start_date].present?
          start_date = Date.parse(params[:start_date])
          Rails.logger.info "Parsed start_date: #{start_date}"
          @issue.start_date = start_date
        end
        
        if params[:due_date].present?
          due_date = Date.parse(params[:due_date])
          Rails.logger.info "Parsed due_date: #{due_date}"
          @issue.due_date = due_date
        end

        if @issue.changed?
          if @issue.save
            render json: { success: true }
          else
            render json: { success: false, errors: @issue.errors.full_messages }, status: :unprocessable_entity
          end
        else
          render json: { success: true, message: 'No changes detected' }
        end
      end
    rescue ActiveRecord::StaleObjectError
      Rails.logger.error "Stale object error for Issue ##{params[:issue_id]}"
      render json: { 
        success: false, 
        errors: ['このチケットは他のユーザーによって更新されました。ページを更新して最新の状態を取得してください。']
      }, status: :conflict
    rescue => e
      Rails.logger.error "Error updating issue dates: #{e.message}"
      render json: { success: false, errors: [e.message] }, status: :unprocessable_entity
    end
  end

  def get_tasks
    @project = Project.find(params[:project_id])
    @issues = @project.issues
      .select('issues.*, trackers.name as tracker_name, issue_statuses.name as status_name')
      .joins(:tracker, :status)
      .where.not(start_date: nil)
      .order(:id)

    tasks = @issues.map do |issue|
      {
        id: issue.id,
        subject: issue.subject,
        start_date: issue.start_date,
        due_date: issue.due_date,
        tracker_name: issue.tracker_name,
        status_name: issue.status_name,
        done_ratio: issue.done_ratio,
        parent_id: issue.parent
      }
    end

    render json: { tasks: tasks }
  end

  private

  def find_project
    @project = Project.find(params[:project_id])
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def authorize
    unless User.current.allowed_to?(:view_gantt, @project) && User.current.allowed_to?(:edit_issues, @project)
      render_403
    end
  end

  def check_module_enabled
    unless @project.module_enabled?(:gantt_editor)
      render_403
    end
  end
end 